"use client";

import { useState, useTransition } from "react";
import {
  User,
  Sliders,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";
import { useTheme } from "@/providers/theme-provider";
import {
  updateProfileSettings,
  addExpenseCategorySetting,
  editExpenseCategorySetting,
  removeExpenseCategorySetting,
  addIncomeSourceSetting,
  editIncomeSourceSetting,
  removeIncomeSourceSetting,
} from "./actions";
import type { Profile, ExpenseCategory, IncomeSource } from "@/lib/types";

interface SettingsClientProps {
  profile: Profile | null;
  categories: ExpenseCategory[];
  sources: IncomeSource[];
}

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
  const [sourceDeleteId, setSourceDeleteId] = useState<string | null>(null);
  const [sourceDeleting, setSourceDeleting] = useState(false);

  const [isPending, startTransition] = useTransition();

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
    setCategoryIcon("📦");
    setCategoryColor("#6366f1");
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(cat: ExpenseCategory) {
    setSelectedCategory(cat);
    setCategoryName(cat.name);
    setCategoryIcon(cat.icon || "📦");
    setCategoryColor(cat.color || "#6366f1");
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
    setSourceModalOpen(true);
  }

  function openEditSourceModal(src: IncomeSource) {
    setSelectedSource(src);
    setSourceName(src.name);
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
        ? await editIncomeSourceSetting(selectedSource.id, { name: sourceName })
        : await addIncomeSourceSetting({ name: sourceName });

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
        description="Configure account profile, localization preferences, expense categories, and income sources"
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <User className="h-4 w-4" /> Profile Preferences
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <Sliders className="h-4 w-4" /> Expense Categories
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-1.5 text-xs font-semibold rounded-lg">
            <TrendingUp className="h-4 w-4" /> Income Sources
          </TabsTrigger>
        </TabsList>

        {/* PROFILE PREFERENCES TAB */}
        <TabsContent value="profile">
          <FintechCard className="max-w-xl">
            <FintechCardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Globe className="h-4 w-4" />
                </div>
                <FintechCardTitle>Profile & Preferences</FintechCardTitle>
              </div>
              <p className="text-xs text-muted-foreground">Configure display name, currency standard, and color theme</p>
            </FintechCardHeader>
            <form onSubmit={handleProfileSave}>
              <FintechCardContent className="space-y-4">
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
                    <Select value={currency} onValueChange={(val) => setCurrency(val || "PHP")}>
                      <SelectTrigger id="prof-curr">
                        <SelectValue placeholder="Select Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHP">PHP (₱)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-theme">Theme Preference <span className="text-rose-500">*</span></Label>
                    <Select value={themeSetting} onValueChange={(val) => setThemeSetting((val || "system") as "light" | "dark" | "system")}>
                      <SelectTrigger id="prof-theme">
                        <SelectValue placeholder="Select Theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light Mode</SelectItem>
                        <SelectItem value="dark">Dark Mode</SelectItem>
                        <SelectItem value="system">System Default</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="pt-3 border-t border-border flex justify-end">
                  <Button type="submit" disabled={isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4 cursor-pointer">
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
              <h3 className="text-sm font-bold text-foreground">Expense Categories</h3>
              <p className="text-xs text-muted-foreground">Manage your custom spending category mappings</p>
            </div>
            <Button onClick={openNewCategoryModal} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4 cursor-pointer">
              <Plus className="mr-1.5 h-4 w-4" /> Add Category
            </Button>
          </div>

          <FintechCard className="p-0 overflow-hidden">
            <FintechCardContent className="p-0">
              <div className="divide-y divide-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-3.5 px-6 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cat.icon || "📦"}</span>
                      <div>
                        <span className="text-xs font-bold text-foreground block">{cat.name}</span>
                        {cat.is_default && (
                          <span className="inline-flex px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-muted-foreground">
                            Default Category
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditCategoryModal(cat)} className="h-8 w-8 text-slate-500">
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
              <h3 className="text-sm font-bold text-foreground">Income Sources</h3>
              <p className="text-xs text-muted-foreground">Configure sources generating income streams</p>
            </div>
            <Button onClick={openNewSourceModal} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4 cursor-pointer">
              <Plus className="mr-1.5 h-4 w-4" /> Add Source
            </Button>
          </div>

          <FintechCard className="p-0 overflow-hidden">
            <FintechCardContent className="p-0">
              <div className="divide-y divide-border">
                {sources.map((src) => (
                  <div key={src.id} className="p-3.5 px-6 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-base shrink-0 text-emerald-600">💰</span>
                      <div>
                        <span className="text-xs font-bold text-foreground block">{src.name}</span>
                        {src.is_default && (
                          <span className="inline-flex px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-muted-foreground">
                            Default Source
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditSourceModal(src)} className="h-8 w-8 text-slate-500">
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
      </Tabs>

      {/* Expense Category Dialog */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedCategory ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>Create custom categories to optimize budgets tracking.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category Name <span className="text-rose-500">*</span></Label>
              <Input
                id="cat-name"
                placeholder="e.g. Subscriptions, Gym"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-icon">Icon Emoji</Label>
                <Input
                  id="cat-icon"
                  placeholder="e.g. 🍿"
                  value={categoryIcon}
                  onChange={(e) => setCategoryIcon(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-color">Color Code</Label>
                <Input
                  id="cat-color"
                  type="color"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  className="h-9 p-0.5"
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
                placeholder="e.g. Freelancing, Store Profits"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSourceModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
