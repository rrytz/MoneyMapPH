"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  User,
  Sliders,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Database,
  HandCoins,
} from "lucide-react";
import { CategoryIcon } from "@/components/shared/category-icon";
import { ICON_CHOICES, resolveCategoryIcon, FALLBACK_ICON_KEY } from "@/lib/categories/icon-map";
import { CATEGORY_COLOR_PALETTE, PALETTE_KEYS, PALETTE_LABELS, resolveCategoryColor } from "@/lib/categories/color-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { BackupCard } from "@/components/shared/backup-card";
import { toast } from "sonner";
import { invalidateChrome } from "@/components/dashboard/dashboard-shell";
import { useTheme } from "@/providers/theme-provider";
import {
  updateProfileSettings,
  uploadAvatar,
  removeAvatar,
  getAvatarUrl,
  addExpenseCategorySetting,
  editExpenseCategorySetting,
  removeExpenseCategorySetting,
  addIncomeSourceSetting,
  editIncomeSourceSetting,
  removeIncomeSourceSetting,
} from "./actions";
import type { Profile, ExpenseCategory, IncomeSource, IncomeSourceType } from "@/lib/types";

interface SettingsClientProps {
  profile: Profile | null;
  categories: ExpenseCategory[];
  sources: IncomeSource[];
}

/**
 * Base UI value -> label maps for the Selects on this page.
 *
 * Base UI's `Select.Value` renders the raw value, not the selected item's
 * children: the items live in a Portal that is unmounted while the popup is
 * closed, so there is no ItemText to read and it falls back to the value
 * string. Without one of these, a pre-populated Select prints "PHP", "system"
 * or "core" in the trigger instead of a label.
 *
 * Declared once at module scope because they are static, and named so a new
 * option cannot be added to a SelectItem without also being added here.
 */
const CURRENCY_LABELS = { PHP: "PHP (₱)", USD: "USD ($)", EUR: "EUR (€)" };
const THEME_LABELS = { light: "Light Mode", dark: "Dark Mode", system: "System Default" };
const SOURCE_TYPE_LABELS = {
  core: "Core income (regular salary)",
  incentive: "Incentive (bonus, OT, commission)",
};

export function SettingsClient({
  profile,
  categories,
  sources,
}: SettingsClientProps) {
  const { setTheme: setAppTheme } = useTheme();

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [currency, setCurrency] = useState(profile?.currency || "PHP");
  const [themeSetting, setThemeSetting] = useState<"light" | "dark" | "system">(profile?.theme || "system");

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");
  const [categoryColor, setCategoryColor] = useState("");
  const [categoryDeleteId, setCategoryDeleteId] = useState<string | null>(null);
  const [categoryDeleting, setCategoryDeleting] = useState(false);

  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<IncomeSource | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<IncomeSourceType>("core");
  const [sourceDeleteId, setSourceDeleteId] = useState<string | null>(null);
  const [sourceDeleting, setSourceDeleting] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Profile picture state. avatarPath mirrors profiles.avatar_path;
  // avatarUrl is a short-lived signed read, minted when a path is set.
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path || null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!avatarPath) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    getAvatarUrl().then((res) => {
      if (!cancelled && res.success) setAvatarUrl(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  // Center-square crop, max 256px, WebP out. Smoothing stays ON (faces are
  // continuous tone - the QR pipeline's smoothing-off + PNG-only exists for
  // binary module edges and does not apply here). No interactive crop for
  // v1: at 32-40px display the center square is the whole decision.
  const AVATAR_MAX_PX = 256;
  async function normalizeAvatar(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const scale = Math.min(1, AVATAR_MAX_PX / side);
    const out = Math.max(1, Math.round(side * scale));
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
      0, 0, out, out
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.9)
    );
    if (!blob) throw new Error("image encoding failed");
    return new File([blob], "avatar.webp", { type: "image/webp" });
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const payload = await normalizeAvatar(file);
      const formData = new FormData();
      formData.append("file", payload);
      const res = await uploadAvatar(formData);
      if (res.error || !res.success || !("path" in res) || !res.path) {
        setAvatarError(res.error || "Unable to save the profile picture. Please try again.");
        return;
      }
      setAvatarPath(res.path);
      invalidateChrome();
      toast.success("Profile picture updated");
    } catch {
      setAvatarError("That file could not be read as an image. Please try another.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarBusy(true);
    setAvatarError(null);
    const res = await removeAvatar();
    setAvatarBusy(false);
    if (!res.success) {
      setAvatarError(res.error || "Unable to remove the profile picture. Please try again.");
      return;
    }
    // Fallback is the provider image (or initials), never a blank:
    // avatar_path nulls while avatar_url is untouched.
    setAvatarPath(null);
    invalidateChrome();
    toast.success("Profile picture removed");
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName || !currency) {
      toast.error("Required fields are empty.");
      return;
    }

    startTransition(async () => {
      const res = await updateProfileSettings({
        display_name: displayName,
        currency,
        theme: themeSetting,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Profile preferences updated");
        setAppTheme(themeSetting);
      }
    });
  }

  function openNewCategoryModal() {
    setSelectedCategory(null);
    setCategoryName("");
    setCategoryIcon(FALLBACK_ICON_KEY);
    setCategoryColor(CATEGORY_COLOR_PALETTE.channel);
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(cat: ExpenseCategory) {
    setSelectedCategory(cat);
    setCategoryName(cat.name);
    // Resolve on read: a legacy emoji (any variation-selector form) becomes
    // its canonical Lucide key so the picker highlights the right cell.
    setCategoryIcon(resolveCategoryIcon(cat.icon));
    setCategoryColor(resolveCategoryColor(cat.color));
    setCategoryModalOpen(true);
  }

  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryName) {
      toast.error("Category name is required.");
      return;
    }

    startTransition(async () => {
      const res = selectedCategory
        ? await editExpenseCategorySetting(selectedCategory.id, {
            name: categoryName,
            icon: categoryIcon,
            color: categoryColor,
          })
        : await addExpenseCategorySetting({
            name: categoryName,
            icon: categoryIcon,
            color: categoryColor,
          });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(selectedCategory ? "Category updated" : "Category added");
        setCategoryModalOpen(false);
      }
    });
  }

  async function handleCategoryDelete() {
    if (!categoryDeleteId) return;
    setCategoryDeleting(true);
    const res = await removeExpenseCategorySetting(categoryDeleteId);
    setCategoryDeleting(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Category deleted");
    }
    setCategoryDeleteId(null);
  }

  function openNewSourceModal() {
    setSelectedSource(null);
    setSourceName("");
    setSourceType("core");
    setSourceModalOpen(true);
  }

  function openEditSourceModal(src: IncomeSource) {
    setSelectedSource(src);
    setSourceName(src.name);
    setSourceType(src.type ?? "core");
    setSourceModalOpen(true);
  }

  async function handleSourceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceName) {
      toast.error("Source name is required.");
      return;
    }

    startTransition(async () => {
      const res = selectedSource
        ? await editIncomeSourceSetting(selectedSource.id, { name: sourceName, type: sourceType })
        : await addIncomeSourceSetting({ name: sourceName, type: sourceType });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(selectedSource ? "Income source updated" : "Income source added");
        setSourceModalOpen(false);
      }
    });
  }

  async function handleSourceDelete() {
    if (!sourceDeleteId) return;
    setSourceDeleting(true);
    const res = await removeIncomeSourceSetting(sourceDeleteId);
    setSourceDeleting(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Income source deleted");
    }
    setSourceDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings"
        description="Profile, categories, income sources, and backup"
      />

      <Tabs defaultValue="profile" className="space-y-6">
        {/* max-w-full + overflow-x-auto + justify-start: four labeled triggers
            are 466px wide in a 360px column. Without containment the strip
            forces the whole page to 466 and selecting the off-screen Backup tab
            drags the entire page sideways (body clipped at the viewport edge).
            The strip itself must be the scroller, so tabs scroll and the page
            does not. justify-start, not center: a centered overflowing flex box
            clips its start beyond scroll reach. The peeking tab is the swipe
            affordance. Local to this strip: the 2- and 3-tab strips fit, and
            the shared TabsList primitive is untouched. */}
        <TabsList className="p-1 rounded-md max-w-full overflow-x-auto justify-start">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs font-normal rounded-md">
            <User className="h-4 w-4" /> Profile Preferences
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-1.5 text-xs font-normal rounded-md">
            <Sliders className="h-4 w-4" /> Expense Categories
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-1.5 text-xs font-normal rounded-md">
            <TrendingUp className="h-4 w-4" /> Income Sources
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-1.5 text-xs font-normal rounded-md">
            <Database className="h-4 w-4" /> Backup
          </TabsTrigger>
        </TabsList>

        {/* PROFILE PREFERENCES TAB */}
        <TabsContent value="profile">
          <FintechCard className="max-w-xl">
            <FintechCardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-sulpot-tint text-sulpot-deep dark:bg-sulpot-tint dark:text-sulpot-bright">
                  <Globe className="h-4 w-4" />
                </div>
                <FintechCardTitle>Profile & Preferences</FintechCardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Configure display name, currency standard, and color theme</p>
            </FintechCardHeader>
            <form onSubmit={handleProfileSave}>
              <FintechCardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Profile Picture</Label>
                  {avatarPath ? (
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile picture on file" className="h-16 w-16 rounded-full border border-border object-cover" />
                      ) : (
                        <div className="h-16 w-16 rounded-full border border-border bg-muted animate-pulse" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">Profile picture on file</p>
                        <div className="flex gap-2 mt-1.5">
                          <Button type="button" variant="outline" size="sm" disabled={avatarBusy} onClick={() => avatarFileRef.current?.click()}>
                            Replace
                          </Button>
                          <Button type="button" variant="ghost" size="sm" disabled={avatarBusy} onClick={handleAvatarRemove} className="text-rose-500">
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground">No profile picture yet. Upload a square photo — it shows in the topbar avatar.</p>
                      <Button type="button" variant="outline" size="sm" disabled={avatarBusy} onClick={() => avatarFileRef.current?.click()} className="mt-2">
                        Upload
                      </Button>
                    </div>
                  )}
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={avatarBusy}
                    onChange={handleAvatarPick}
                  />
                  {avatarError && (
                    <p role="alert" className="text-xs text-rose-500">{avatarError}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-name">Display Name <span className="text-rose-500">*</span></Label>
                  <Input
                    id="prof-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-curr">Currency Preference <span className="text-rose-500">*</span></Label>
                    <Select value={currency} onValueChange={(val) => setCurrency(val || "PHP")} items={CURRENCY_LABELS}>
                      <SelectTrigger id="prof-curr" className="w-full">
                        <SelectValue placeholder="Select Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHP">{CURRENCY_LABELS.PHP}</SelectItem>
                        <SelectItem value="USD">{CURRENCY_LABELS.USD}</SelectItem>
                        <SelectItem value="EUR">{CURRENCY_LABELS.EUR}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-theme">Theme Preference <span className="text-rose-500">*</span></Label>
                    <Select value={themeSetting} onValueChange={(val) => setThemeSetting((val || "system") as "light" | "dark" | "system")} items={THEME_LABELS}>
                      <SelectTrigger id="prof-theme" className="w-full">
                        <SelectValue placeholder="Select Theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">{THEME_LABELS.light}</SelectItem>
                        <SelectItem value="dark">{THEME_LABELS.dark}</SelectItem>
                        <SelectItem value="system">{THEME_LABELS.system}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="pt-3 border-t border-border flex justify-end">
                  {/* Disabled on required-EMPTY, never on invalid. Currency and
                      theme prefill, so display name is the only emptyable. */}
                  <Button type="submit" disabled={isPending || !displayName.trim()} className="rounded-md bg-primary hover:bg-primary/80 text-white font-medium text-xs h-9 px-4 cursor-pointer">
                    {isPending ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </FintechCardContent>
            </form>
          </FintechCard>
        </TabsContent>

        {/* EXPENSE CATEGORIES TAB */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="section-head text-foreground">Expense Categories</h3>
              <p className="text-xs text-muted-foreground">Manage your custom spending categories</p>
            </div>
            <Button onClick={openNewCategoryModal} className="rounded-md bg-primary hover:bg-primary/80 text-white font-medium text-xs h-9 px-4 cursor-pointer">
              <Plus className="mr-1.5 h-4 w-4" /> Add Category
            </Button>
          </div>

          <FintechCard className="p-0 overflow-hidden">
            <FintechCardContent className="p-0">
              <div className="divide-y divide-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-3.5 px-6 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <CategoryIcon
                        icon={cat.icon}
                        size="md"
                        className="h-5 w-5"
                      />
                      <div>
                        <span className="text-xs font-bold text-foreground block">{cat.name}</span>
                        {cat.is_default && (
                          <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 bg-muted/60 text-muted-foreground">
                            Default Category
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditCategoryModal(cat)} className="h-8 w-8 text-ink-muted">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!cat.is_default && (
                        <Button variant="ghost" size="icon" onClick={() => setCategoryDeleteId(cat.id)} className="h-8 w-8 text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </FintechCardContent>
          </FintechCard>
        </TabsContent>

        {/* INCOME SOURCES TAB */}
        <TabsContent value="sources" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="section-head text-foreground">Income Sources</h3>
              <p className="text-xs text-muted-foreground">Configure sources generating income streams</p>
            </div>
            <Button onClick={openNewSourceModal} className="rounded-md bg-primary hover:bg-primary/80 text-white font-medium text-xs h-9 px-4 cursor-pointer">
              <Plus className="mr-1.5 h-4 w-4" /> Add Source
            </Button>
          </div>

          <FintechCard className="p-0 overflow-hidden">
            <FintechCardContent className="p-0">
              <div className="divide-y divide-border">
                {sources.map((src) => (
                  <div key={src.id} className="p-3.5 px-6 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <HandCoins className="h-4 w-4 shrink-0 text-sulpot-deep dark:text-sulpot-bright" />
                      <div>
                        <span className="text-xs font-bold text-foreground block">{src.name}</span>
                        {src.is_default && (
                          <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 bg-muted/60 text-muted-foreground">
                            Default Source
                          </Badge>
                        )}
                        {src.type === "incentive" && (
                          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200/50">
                            Incentive
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditSourceModal(src)} className="h-8 w-8 text-ink-muted">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!src.is_default && (
                        <Button variant="ghost" size="icon" onClick={() => setSourceDeleteId(src.id)} className="h-8 w-8 text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </FintechCardContent>
          </FintechCard>
        </TabsContent>

        {/* BACKUP & RESTORE TAB */}
        <TabsContent value="backup">
          <BackupCard />
        </TabsContent>
      </Tabs>

      {/* Expense Category Dialog */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>Create custom categories for budget tracking.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category Name <span className="text-rose-500">*</span></Label>
              <Input
                id="cat-name"
                placeholder="Subscriptions"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div
                role="radiogroup"
                aria-label="Category icon"
                className="grid grid-cols-7 gap-1.5 rounded-lg border border-border bg-muted/30 p-2"
              >
                {ICON_CHOICES.map(({ key, label }) => {
                  const selected = resolveCategoryIcon(categoryIcon) === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={label}
                      title={label}
                      onClick={() => setCategoryIcon(key)}
                      className={`flex h-9 w-9 items-center justify-center rounded-md border transition ${
                        selected
                          ? "border-sulpot bg-sulpot/10 text-sulpot-deep dark:text-sulpot-bright dark:text-sulpot-bright"
                          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <CategoryIcon icon={key} className="h-4.5 w-4.5" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div
                role="radiogroup"
                aria-label="Category color"
                className="flex flex-wrap gap-2"
              >
                {PALETTE_KEYS.map((paletteKey) => {
                  const hex = CATEGORY_COLOR_PALETTE[paletteKey];
                  const selected = resolveCategoryColor(categoryColor).toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={paletteKey}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={PALETTE_LABELS[paletteKey]}
                      title={PALETTE_LABELS[paletteKey]}
                      onClick={() => setCategoryColor(hex)}
                      className={`h-9 w-9 rounded-lg border-2 transition ${
                        selected ? "border-sulpot ring-2 ring-sulpot/30" : "border-border hover:border-foreground/30"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>
                Cancel
              </Button>
              {/* Disabled on required-EMPTY, never on invalid. */}
              <Button type="submit" disabled={isPending || !categoryName.trim()} className="bg-primary hover:bg-primary/80 text-white">
                {selectedCategory ? "Save Changes" : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Income Source Dialog */}
      <Dialog open={sourceModalOpen} onOpenChange={setSourceModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedSource ? "Edit Income Source" : "Add Income Source"}</DialogTitle>
            <DialogDescription>Define custom income sources for transaction listings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSourceSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="src-name">Source Name <span className="text-rose-500">*</span></Label>
              <Input
                id="src-name"
                placeholder="Freelancing"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="src-type">Source Type</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType((v || "core") as IncomeSourceType)} items={SOURCE_TYPE_LABELS}>
                <SelectTrigger id="src-type" className="w-full">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">{SOURCE_TYPE_LABELS.core}</SelectItem>
                  <SelectItem value="incentive">{SOURCE_TYPE_LABELS.incentive}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Core income is paychecks only. Incentives count toward safe-to-spend only when you log them.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSourceModalOpen(false)}>
                Cancel
              </Button>
              {/* Disabled on required-EMPTY, never on invalid. */}
              <Button type="submit" disabled={isPending || !sourceName.trim()} className="bg-primary hover:bg-primary/80 text-white">
                {selectedSource ? "Save Changes" : "Add Source"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!categoryDeleteId}
        onOpenChange={(open) => !open && setCategoryDeleteId(null)}
        onConfirm={handleCategoryDelete}
        title="Delete Expense Category"
        description="Permanently delete this category. Budgets mapped to this category will be removed. Transaction associations will set category references to null."
        loading={categoryDeleting}
      />

      <ConfirmDialog
        open={!!sourceDeleteId}
        onOpenChange={(open) => !open && setSourceDeleteId(null)}
        onConfirm={handleSourceDelete}
        title="Delete Income Source"
        description="Permanently delete this source. Associated income transactions will lose source mappings. This action cannot be undone."
        loading={sourceDeleting}
      />
    </div>
  );
}
