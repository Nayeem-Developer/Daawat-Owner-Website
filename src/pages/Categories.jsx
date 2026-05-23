import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Modal from "../components/Modal";
import api, { getErrorMessage, uploadImage } from "../services/api";
import { formatCurrency } from "../services/formatters";

const FINAL_CATEGORY_ORDER = [
  "Biryani",
  "Soups",
  "Starters",
  "Fried Chicken",
  "Rice",
  "Noodles",
];

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "veg", label: "Veg" },
  { key: "non-veg", label: "Non-Veg" },
];

const CATEGORY_ALIAS_RULES = [
  [/^biryani'?s?$/i, "Biryani"],
  [/^biryanis$/i, "Biryani"],
  [/^soups?$/i, "Soups"],
  [/^veg soups?$/i, "Soups"],
  [/^non[\s-]?veg soups?$/i, "Soups"],
  [/^starters?$/i, "Starters"],
  [/^veg starters?$/i, "Starters"],
  [/^non[\s-]?veg starters?$/i, "Starters"],
  [/^fried chicken$/i, "Fried Chicken"],
  [/^rice$/i, "Rice"],
  [/^veg rice$/i, "Rice"],
  [/^non[\s-]?veg rice$/i, "Rice"],
  [/^noodles$/i, "Noodles"],
  [/^veg[\s-]*-?[\s-]*non[\s-]?veg noodles$/i, "Noodles"],
];

const getListFromResponseBody = (responseBody, keys = []) => {
  const items = Array.isArray(responseBody?.data)
    ? responseBody.data
    : Array.isArray(responseBody?.items)
      ? responseBody.items
      : Array.isArray(responseBody)
        ? responseBody
        : [];

  if (items.length > 0) {
    return items;
  }

  for (const key of keys) {
    if (Array.isArray(responseBody?.[key])) {
      return responseBody[key];
    }

    if (Array.isArray(responseBody?.data?.[key])) {
      return responseBody.data[key];
    }
  }

  return items;
};

const getListFromResponse = (response, keys = []) =>
  getListFromResponseBody(response?.data, keys);

const getMenuItemsFromResponse = (response) =>
  getListFromResponseBody(response?.data, ["menuItems", "items"]);

const getCountFromCategory = (category) => {
  const candidates = [
    category?.itemCount,
    category?.itemsCount,
    category?.totalItems,
    category?.menuItemsCount,
    category?.menuItemCount,
  ];

  for (const candidate of candidates) {
    if (Number.isFinite(Number(candidate))) {
      return Number(candidate);
    }
  }

  return null;
};

const resolveCanonicalCategoryName = (value) => {
  const raw = String(value || "").trim();

  for (const [pattern, name] of CATEGORY_ALIAS_RULES) {
    if (pattern.test(raw)) {
      return name;
    }
  }

  return null;
};

const toNormalizedText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeCategory = (category) => {
  const canonicalName = resolveCanonicalCategoryName(category?.name || "");

  return {
    ...category,
    _id: category?._id || category?.id || "",
    canonicalName,
    name: canonicalName || category?.name || "Unnamed Category",
    imageUrl: category?.imageUrl || category?.image || "",
    itemCount: getCountFromCategory(category),
    sourceCategoryIds: [],
  };
};

const normalizeItem = (item) => {
  const hasIsVeg = typeof item?.isVeg === "boolean";
  if (!hasIsVeg) {
    console.warn("Menu item missing isVeg field", item);
  }

  return {
    ...item,
    _id: item?._id || item?.id || "",
    name: item?.name || "",
    categoryId: item?.categoryId?._id || item?.category?._id || item?.categoryId || "",
    price: Number(item?.price) || 0,
    imageUrl: item?.imageUrl || item?.image || "",
    description: item?.description || "",
    isVeg: item?.isVeg === true,
    isAvailable: item?.isAvailable !== false,
    isActive: item?.isActive !== false,
  };
};

const createInitialForm = (categoryId, sourceItem = null) => ({
  name: sourceItem?.name || "",
  price: sourceItem ? String(sourceItem.price ?? "") : "",
  imageUrl: sourceItem?.imageUrl || "",
  imageFile: null,
  isVeg: typeof sourceItem?.isVeg === "boolean" ? sourceItem.isVeg : true,
  isAvailable:
    typeof sourceItem?.isAvailable === "boolean" ? sourceItem.isAvailable : true,
  categoryId: sourceItem?.categoryId || categoryId || "",
  description: sourceItem?.description || "",
});

const categoryFallbackGradients = [
  "linear-gradient(135deg, rgba(160, 39, 46, 0.96), rgba(213, 164, 74, 0.68))",
  "linear-gradient(135deg, rgba(103, 39, 26, 0.96), rgba(184, 106, 40, 0.72))",
  "linear-gradient(135deg, rgba(63, 17, 17, 0.96), rgba(126, 48, 30, 0.78))",
  "linear-gradient(135deg, rgba(114, 32, 38, 0.96), rgba(77, 48, 18, 0.78))",
];

const itemFallbackGradient =
  "linear-gradient(135deg, rgba(100, 31, 35, 0.92), rgba(213, 164, 74, 0.64))";

function CategoryCard({ category, isActive, count, onSelect, onEdit, index }) {
  return (
    <div
      className={`category-card ${isActive ? "active" : ""}`}
      onClick={() => onSelect(category._id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(category._id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
    >
      <button
        type="button"
        className="category-edit-icon"
        aria-label={`Edit ${category.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onEdit(category);
        }}
      >
        ✏️
      </button>

      <div className="category-card-media">
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} loading="lazy" />
        ) : (
          <div
            className="category-fallback"
            style={{
              background:
                categoryFallbackGradients[index % categoryFallbackGradients.length],
            }}
          >
            <span>{category.name.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="category-card-content">
        <h4>{category.name}</h4>
        <p>{Number.isFinite(count) ? `${count} item${count === 1 ? "" : "s"}` : "Manage menu"}</p>
      </div>
    </div>
  );
}

function AddCategoryCard({ onClick }) {
  return (
    <button
      type="button"
      className="category-card add-category-card"
      onClick={onClick}
      aria-label="Add Category"
    >
      <span className="add-category-icon">+</span>
      <span className="add-category-title">Add Category</span>
    </button>
  );
}

function AddCategoryModal({
  isOpen,
  name,
  file,
  saving,
  uploading,
  onClose,
  onSubmit,
  onNameChange,
  onFileChange,
}) {
  const previewUrl = useMemo(() => {
    if (!file) {
      return "";
    }

    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    if (!previewUrl) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card category-form-modal">
        <div className="item-form-head">
          <h3>Add New Category</h3>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            disabled={saving || uploading}
          >
            Close
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Category Name
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="e.g. Desserts"
              required
            />
          </label>

          <div className="item-upload-row">
            <label>
              Category Image (optional)
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
              />
            </label>

            <div className="item-image-preview">
              {previewUrl ? (
                <img src={previewUrl} alt="Category preview" />
              ) : (
                <div className="menu-item-fallback" style={{ background: itemFallbackGradient }}>
                  <span>C</span>
                </div>
              )}
            </div>
          </div>

          {uploading ? (
            <p className="category-uploading-note">Uploading image...</p>
          ) : null}

          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={saving || uploading}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving || uploading}>
              {saving ? "Saving..." : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditCategoryModal({
  isOpen,
  name,
  imageUrl,
  file,
  saving,
  deleting,
  uploading,
  onClose,
  onSubmit,
  onNameChange,
  onFileChange,
  onDeleteClick,
}) {
  const previewUrl = useMemo(() => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return imageUrl || "";
  }, [file, imageUrl]);

  useEffect(() => {
    if (!file || !previewUrl) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [file, previewUrl]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card category-form-modal">
        <div className="item-form-head">
          <h3>Edit Category</h3>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            disabled={saving || deleting || uploading}
          >
            Close
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Category Name
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="e.g. Biryani"
              required
            />
          </label>

          <div className="item-upload-row">
            <label>
              Change Category Image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
              />
            </label>

            <div className="item-image-preview">
              {previewUrl ? (
                <img src={previewUrl} alt="Category preview" />
              ) : (
                <div className="menu-item-fallback" style={{ background: itemFallbackGradient }}>
                  <span>C</span>
                </div>
              )}
            </div>
          </div>

          {uploading ? (
            <p className="category-uploading-note">Uploading image...</p>
          ) : null}

          <div className="modal-actions category-edit-actions">
            <button
              type="button"
              className="btn danger"
              onClick={onDeleteClick}
              disabled={saving || deleting || uploading}
            >
              {deleting ? "Deleting..." : "Delete Category"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={saving || deleting || uploading}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving || deleting || uploading}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MenuItemCard({ item, deleteMode, onEdit, onDelete }) {
  return (
    <article className="menu-item-card">
      {deleteMode && (
        <button
          type="button"
          className="item-delete-float"
          aria-label={`Delete ${item.name}`}
          onClick={() => onDelete(item)}
        >
          x
        </button>
      )}

      <div className="menu-item-media">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" />
        ) : (
          <div className="menu-item-fallback" style={{ background: itemFallbackGradient }}>
            <span>{item.name.slice(0, 1).toUpperCase() || "M"}</span>
          </div>
        )}
      </div>

      <div className="menu-item-content">
        <h4>{item.name}</h4>
        <p className="menu-item-price">{formatCurrency(item.price)}</p>
        <div className="menu-item-badges">
          <span className={`badge ${item.isVeg ? "veg" : "non-veg"}`}>
            {item.isVeg ? "Veg" : "Non-Veg"}
          </span>
          <span className={`badge ${item.isAvailable ? "available" : "unavailable"}`}>
            {item.isAvailable ? "Available" : "Unavailable"}
          </span>
        </div>
        <button type="button" className="btn ghost item-edit-btn" onClick={() => onEdit(item)}>
          Edit
        </button>
      </div>
    </article>
  );
}

function ItemFormModal({
  isOpen,
  mode,
  categoryName,
  form,
  submitting,
  supportsAvailability,
  onClose,
  onSubmit,
  onChange,
}) {
  const previewUrl = useMemo(() => {
    if (!form.imageFile) {
      return form.imageUrl;
    }

    return URL.createObjectURL(form.imageFile);
  }, [form.imageFile, form.imageUrl]);

  useEffect(() => {
    if (!previewUrl || !previewUrl.startsWith("blob:")) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card item-form-modal">
        <div className="item-form-head">
          <h3>{mode === "edit" ? "Edit Menu Item" : "Add New Item"}</h3>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Close
          </button>
        </div>

        <p className="item-form-subtitle">Category: {categoryName}</p>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Item name
            <input
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              placeholder="e.g. Chicken Biryani"
              required
            />
          </label>

          <label>
            Price
            <input
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(event) => onChange("price", event.target.value)}
              placeholder="120"
              required
            />
          </label>

          <label>
            Description (optional)
            <textarea
              rows="2"
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Short note about the item"
            />
          </label>

          <div className="item-upload-row">
            <label>
              Upload image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onChange("imageFile", event.target.files?.[0] || null)}
              />
            </label>

            <div className="item-image-preview">
              {previewUrl ? (
                <img src={previewUrl} alt="Item preview" />
              ) : (
                <div className="menu-item-fallback" style={{ background: itemFallbackGradient }}>
                  <span>P</span>
                </div>
              )}
            </div>
          </div>

          <div className="item-option-row">
            <label>
              Type
              <select
                value={form.isVeg ? "veg" : "non-veg"}
                onChange={(event) => onChange("isVeg", event.target.value === "veg")}
              >
                <option value="veg">Veg</option>
                <option value="non-veg">Non-Veg</option>
              </select>
            </label>

            {supportsAvailability && (
              <label className="check-row availability-check">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) => onChange("isAvailable", event.target.checked)}
                />
                Available
              </label>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="category-scroll" aria-hidden="true">
      {[1, 2, 3, 4].map((card) => (
        <div key={card} className="category-card category-skeleton">
          <div className="category-skeleton-media" />
          <div className="category-skeleton-lines">
            <div />
            <div />
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemsSkeleton() {
  return (
    <div className="menu-items-grid" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((card) => (
        <div key={card} className="menu-item-card menu-item-skeleton">
          <div className="menu-item-skeleton-media" />
          <div className="menu-item-skeleton-lines">
            <div />
            <div />
            <div />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Categories() {
  const outletContext = useOutletContext();
  const addToast = outletContext?.addToast || (() => {});

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");

  const [itemCountMap, setItemCountMap] = useState({});
  const [deleteMode, setDeleteMode] = useState(false);

  const [modalMode, setModalMode] = useState("add");
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(() => createInitialForm(""));

  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryImageFile, setNewCategoryImageFile] = useState(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryUploading, setCategoryUploading] = useState(false);
  const [editCategoryModalOpen, setEditCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryImageUrl, setEditCategoryImageUrl] = useState("");
  const [editCategoryImageFile, setEditCategoryImageFile] = useState(null);
  const [editCategorySaving, setEditCategorySaving] = useState(false);
  const [editCategoryUploading, setEditCategoryUploading] = useState(false);
  const [deleteCategoryConfirmOpen, setDeleteCategoryConfirmOpen] = useState(false);
  const [categoryDeleting, setCategoryDeleting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((category) => category._id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const supportsAvailability = useMemo(() => {
    if (items.length > 0) {
      return items.some((item) => typeof item?.isAvailable === "boolean");
    }

    return true;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (typeFilter === "veg") {
      return items.filter((item) => item.isVeg === true);
    }

    if (typeFilter === "non-veg") {
      return items.filter((item) => item.isVeg === false);
    }

    return items;
  }, [items, typeFilter]);

  const fetchItemsByCategory = useCallback(
    async (category, { showLoading = true } = {}) => {
      if (!category?._id) {
        setItems([]);
        setItemsError("");
        return [];
      }

      try {
        if (showLoading) {
          setItemsLoading(true);
        }
        setItemsError("");

        const sourceCategoryIds =
          Array.isArray(category.sourceCategoryIds) && category.sourceCategoryIds.length > 0
            ? category.sourceCategoryIds
            : [category._id];

        console.log("Selected category:", category);
        console.log(
          "Owner menu API URL:",
          `/api/owner/menu-items?categoryId=${category._id}`
        );

        const responses = await Promise.all(
          sourceCategoryIds.map((sourceCategoryId) =>
            api.get("/api/owner/menu-items", {
              params: { categoryId: sourceCategoryId },
            })
          )
        );

        const mergedRawItems = responses.flatMap((response, index) => {
          const responseBody = response?.data;
          const items = getMenuItemsFromResponse(response);
          console.log("Owner panel API response:", responseBody);
          console.log("Parsed items:", items.length);
          return Array.isArray(items)
            ? items.map((item) => ({
                ...item,
                __sourceCategoryId: sourceCategoryIds[index],
              }))
            : [];
        });

        const dedupedByItemId = new Map();
        for (const item of mergedRawItems) {
          const key = item?._id || item?.id || `${item?.name}-${item?.__sourceCategoryId}`;
          if (!dedupedByItemId.has(key)) {
            dedupedByItemId.set(key, item);
          }
        }

        const normalized = Array.from(dedupedByItemId.values()).map(normalizeItem);
        console.log("Normalized category items:", normalized);
        console.log("All count:", normalized.length);
        console.log(
          "Veg count:",
          normalized.filter((i) => i.isVeg === true).length
        );
        console.log(
          "NonVeg count:",
          normalized.filter((i) => i.isVeg === false).length
        );

        setItems(normalized);
        setItemCountMap((prev) => ({ ...prev, [category._id]: normalized.length }));
        return normalized;
      } catch (error) {
        setItemsError(getErrorMessage(error, "Failed to load items. Retry"));
        return [];
      } finally {
        if (showLoading) {
          setItemsLoading(false);
        }
      }
    },
    []
  );

  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      setCategoriesError("");

      const response = await api.get("/api/owner/categories");
      const responseBody = response?.data;
      const list = getListFromResponse(response, ["categories"]);
      console.log("Owner panel API response:", responseBody);
      console.log("Parsed items:", list.length);
      const normalized = list
        .map(normalizeCategory)
        .filter((category) => category._id && category.isActive !== false);

      const canonicalCategories = normalized.filter((category) =>
        FINAL_CATEGORY_ORDER.includes(category.name)
      );

      const groupsByCanonical = canonicalCategories.reduce((accumulator, category) => {
        const group = accumulator.get(category.name) || [];
        group.push(category);
        accumulator.set(category.name, group);
        return accumulator;
      }, new Map());

      const unifiedCategories = FINAL_CATEGORY_ORDER.map((name) => {
        const group = groupsByCanonical.get(name);
        if (!group || group.length === 0) {
          return null;
        }

        const exactCategory = group.find(
          (category) => toNormalizedText(category.name) === toNormalizedText(name)
        );
        const imageCategory = group.find((category) => Boolean(category.imageUrl));
        const primary = exactCategory || group[0];
        const sourceCategoryIds = group.map((category) => category._id).filter(Boolean);

        const summedCount = group.reduce((accumulator, category) => {
          return accumulator + (Number.isFinite(category.itemCount) ? category.itemCount : 0);
        }, 0);
        const hasAnyCount = group.some((category) => Number.isFinite(category.itemCount));

        return {
          ...primary,
          name,
          canonicalName: name,
          imageUrl: imageCategory?.imageUrl || primary.imageUrl || "",
          sourceCategoryIds,
          itemCount: hasAnyCount ? summedCount : null,
        };
      }).filter(Boolean);

      const customCategoriesMap = new Map();
      const customCategories = normalized.filter(
        (category) => !FINAL_CATEGORY_ORDER.includes(category.name)
      );

      for (const category of customCategories) {
        const key = toNormalizedText(category.name);
        if (!key) {
          continue;
        }
        if (customCategoriesMap.has(key)) {
          continue;
        }
        customCategoriesMap.set(key, {
          ...category,
          sourceCategoryIds: [category._id],
        });
      }

      const combinedCategories = [
        ...unifiedCategories,
        ...Array.from(customCategoriesMap.values()),
      ];

      setCategories(combinedCategories);
      setItemCountMap(
        combinedCategories.reduce((accumulator, category) => {
          if (Number.isFinite(category.itemCount)) {
            accumulator[category._id] = category.itemCount;
          }
          return accumulator;
        }, {})
      );

      if (combinedCategories.length > 0) {
        setSelectedCategoryId((current) =>
          combinedCategories.some((item) => item._id === current)
            ? current
            : combinedCategories[0]._id
        );
      } else {
        setSelectedCategoryId("");
        setItems([]);
      }

      if (combinedCategories.length > 0) {
        void Promise.allSettled(
          combinedCategories.map(async (category) => {
            if (!category._id || Number.isFinite(category.itemCount)) {
              return;
            }
            const sourceCategoryIds =
              Array.isArray(category.sourceCategoryIds) && category.sourceCategoryIds.length > 0
                ? category.sourceCategoryIds
                : [category._id];

            const responsesBySource = await Promise.all(
              sourceCategoryIds.map((sourceCategoryId) =>
                api.get("/api/owner/menu-items", {
                  params: { categoryId: sourceCategoryId },
                })
              )
            );

            const categoryItems = responsesBySource.flatMap((response) => {
              const responseBody = response?.data;
              const items = getMenuItemsFromResponse(response);
              console.log("Owner panel API response:", responseBody);
              console.log("Parsed items:", items.length);
              return Array.isArray(items) ? items : [];
            });

            setItemCountMap((prev) => ({ ...prev, [category._id]: categoryItems.length }));
          })
        );
      }
    } catch (error) {
      setCategoriesError(getErrorMessage(error, "Failed to load categories"));
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchCategories();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchCategories]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    setTypeFilter("all");
    void fetchItemsByCategory(selectedCategory);
    setDeleteMode(false);
  }, [fetchItemsByCategory, selectedCategory]);

  const handleCategorySelect = (categoryId) => {
    if (categoryId === selectedCategoryId) {
      return;
    }
    setSelectedCategoryId(categoryId);
  };

  const openEditCategoryModal = (category) => {
    console.log("Editing category:", category);
    setEditingCategory(category);
    setEditCategoryName(category?.name || "");
    setEditCategoryImageUrl(category?.imageUrl || "");
    setEditCategoryImageFile(null);
    setDeleteCategoryConfirmOpen(false);
    setEditCategoryModalOpen(true);
  };

  const closeEditCategoryModal = () => {
    if (editCategorySaving || editCategoryUploading || categoryDeleting) {
      return;
    }
    setEditCategoryModalOpen(false);
    setEditingCategory(null);
    setEditCategoryName("");
    setEditCategoryImageUrl("");
    setEditCategoryImageFile(null);
    setDeleteCategoryConfirmOpen(false);
  };

  const openAddCategoryModal = () => {
    setAddCategoryModalOpen(true);
  };

  const closeAddCategoryModal = () => {
    if (categorySaving || categoryUploading) {
      return;
    }
    setAddCategoryModalOpen(false);
    setNewCategoryName("");
    setNewCategoryImageFile(null);
  };

  const uploadCategoryImage = async (selectedFile) => {
    const formData = new FormData();
    formData.append("image", selectedFile);

    const uploadResponse = await api.post("/api/owner/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    console.log("Category upload response:", uploadResponse.data);

    return (
      uploadResponse.data?.imageUrl ||
      uploadResponse.data?.data?.imageUrl ||
      uploadResponse.data?.url ||
      ""
    );
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();

    const trimmedCategoryName = newCategoryName.trim();
    if (!trimmedCategoryName) {
      addToast({
        title: "Invalid input",
        message: "Please enter category name",
        type: "error",
      });
      return;
    }

    try {
      setCategorySaving(true);
      let imageUrl = "";

      if (newCategoryImageFile) {
        console.log("Selected category image:", newCategoryImageFile);
        setCategoryUploading(true);
        try {
          imageUrl = await uploadCategoryImage(newCategoryImageFile);
        } catch (uploadError) {
          addToast({
            title: "Upload failed",
            message:
              uploadError?.response?.data?.message ||
              uploadError?.data?.message ||
              "Image upload failed. Please try again or add category without image.",
            type: "error",
          });
          return;
        } finally {
          setCategoryUploading(false);
        }

        if (!imageUrl) {
          addToast({
            title: "Upload failed",
            message: "Image upload failed. Please try again or add category without image.",
            type: "error",
          });
          return;
        }
      }

      const payload = {
        name: trimmedCategoryName,
        imageUrl,
      };

      console.log("Create category payload:", payload);

      const response = await api.post("/api/owner/categories", payload);
      const createdCategory =
        response.data?.data || response.data?.category || response.data || null;

      setAddCategoryModalOpen(false);
      setNewCategoryName("");
      setNewCategoryImageFile(null);

      await fetchCategories();

      const createdCategoryId = createdCategory?._id || createdCategory?.id;
      if (createdCategoryId) {
        setSelectedCategoryId(createdCategoryId);
      }

      addToast({
        title: "Success",
        message: "Category added successfully",
        type: "success",
      });
    } catch (error) {
      console.log("Create category error:", error?.response?.data || error?.data || error);
      addToast({
        title: "Create failed",
        message:
          error?.response?.data?.message ||
          error?.data?.message ||
          "Category already exists",
        type: "error",
      });
    } finally {
      setCategorySaving(false);
      setCategoryUploading(false);
    }
  };

  const handleSaveCategoryChanges = async (event) => {
    event.preventDefault();

    if (!editingCategory?._id) {
      return;
    }

    const trimmedName = editCategoryName.trim();
    if (!trimmedName) {
      addToast({
        title: "Invalid input",
        message: "Please enter category name",
        type: "error",
      });
      return;
    }

    try {
      setEditCategorySaving(true);
      let finalImageUrl = editCategoryImageUrl || "";

      if (editCategoryImageFile) {
        setEditCategoryUploading(true);
        try {
          finalImageUrl = await uploadCategoryImage(editCategoryImageFile);
        } catch (uploadError) {
          addToast({
            title: "Upload failed",
            message:
              uploadError?.response?.data?.message ||
              uploadError?.data?.message ||
              "Image upload failed. Please try again.",
            type: "error",
          });
          return;
        } finally {
          setEditCategoryUploading(false);
        }

        if (!finalImageUrl) {
          addToast({
            title: "Upload failed",
            message: "Image upload failed. Please try again.",
            type: "error",
          });
          return;
        }
      }

      const payload = {
        name: trimmedName,
        imageUrl: finalImageUrl,
      };
      console.log("Category update payload:", payload);

      const response = await api.patch(
        `/api/owner/categories/${editingCategory._id}`,
        payload
      );
      console.log("Category update response:", response.data);

      const editedCategoryId = editingCategory._id;
      setEditCategoryModalOpen(false);
      setEditingCategory(null);
      setEditCategoryName("");
      setEditCategoryImageUrl("");
      setEditCategoryImageFile(null);

      await fetchCategories();
      if (editedCategoryId) {
        setSelectedCategoryId(editedCategoryId);
      }

      addToast({
        title: "Success",
        message: "Category updated successfully",
        type: "success",
      });
    } catch (error) {
      addToast({
        title: "Update failed",
        message:
          error?.response?.data?.message ||
          error?.data?.message ||
          "Category already exists",
        type: "error",
      });
    } finally {
      setEditCategorySaving(false);
      setEditCategoryUploading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory?._id) {
      return;
    }

    try {
      setCategoryDeleting(true);
      console.log("Deleting category id:", editingCategory._id);
      const response = await api.delete(`/api/owner/categories/${editingCategory._id}`);
      console.log("Delete category response:", response.data);

      const deletingCategoryId = editingCategory._id;
      setDeleteCategoryConfirmOpen(false);
      setEditCategoryModalOpen(false);
      setEditingCategory(null);
      setEditCategoryName("");
      setEditCategoryImageUrl("");
      setEditCategoryImageFile(null);

      await fetchCategories();

      if (selectedCategoryId === deletingCategoryId) {
        setSelectedCategoryId((current) => (current === deletingCategoryId ? "" : current));
      }

      addToast({
        title: "Success",
        message: "Category removed successfully",
        type: "success",
      });
    } catch (error) {
      addToast({
        title: "Delete failed",
        message:
          error?.response?.data?.message ||
          error?.data?.message ||
          getErrorMessage(error, "Failed to delete category"),
        type: "error",
      });
    } finally {
      setCategoryDeleting(false);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode("add");
    setEditingItem(null);
    setItemForm(createInitialForm(selectedCategoryId));
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setModalMode("edit");
    setEditingItem(item);
    setItemForm(createInitialForm(selectedCategoryId, item));
    setFormModalOpen(true);
  };

  const handleChangeItemForm = (field, value) => {
    setItemForm((prev) => ({ ...prev, [field]: value }));
  };

  const closeItemModal = () => {
    if (formSubmitting) {
      return;
    }
    setFormModalOpen(false);
    setEditingItem(null);
    setItemForm(createInitialForm(selectedCategoryId));
  };

  const handleSaveItem = async (event) => {
    event.preventDefault();

    if (!selectedCategory || !selectedCategory._id) {
      addToast({
        title: "Category required",
        message: "Please select a category first.",
        type: "error",
      });
      return;
    }

    const itemId = editingItem?._id;

    try {
      setFormSubmitting(true);
      let imageUrl = itemForm.imageUrl || "";

      if (itemForm.imageFile) {
        console.log("Selected file:", itemForm.imageFile);
        try {
          imageUrl = await uploadImage(itemForm.imageFile);
          console.log("Final imageUrl:", imageUrl);
        } catch (uploadError) {
          console.log(
            "Upload response:",
            uploadError?.response?.data || uploadError?.data || uploadError?.message
          );
          addToast({
            title: "Upload failed",
            message:
              uploadError?.response?.data?.message ||
              uploadError?.data?.message ||
              "Image upload failed. Please try again or add item without image.",
            type: "error",
          });
          return;
        }

        if (!imageUrl) {
          addToast({
            title: "Upload failed",
            message: "Image upload failed. Please try again or add item without image.",
            type: "error",
          });
          return;
        }
      }

      const trimmedName = itemForm.name.trim();
      const numericPrice = Number(itemForm.price);
      if (!trimmedName) {
        addToast({
          title: "Invalid input",
          message: "Please enter item name.",
          type: "error",
        });
        return;
      }

      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        addToast({
          title: "Invalid input",
          message: "Please enter a valid price.",
          type: "error",
        });
        return;
      }

      const selectedVegValue = itemForm.isVeg ? "veg" : "non-veg";
      const basePayload = {
        name: trimmedName,
        categoryId: selectedCategory._id,
        price: numericPrice,
        imageUrl: imageUrl || "",
        description: itemForm.description?.trim() || "",
        isVeg: selectedVegValue === "veg",
        isActive: true,
      };

      console.log("Selected category:", selectedCategory);

      if (modalMode === "edit" && itemId) {
        const payload = {
          ...basePayload,
          isAvailable: Boolean(itemForm.isAvailable),
        };

        console.log("[Categories] Update item payload", { id: itemId, payload });
        const response = await api.patch(`/api/owner/menu-items/${itemId}`, payload);
        console.log("[Categories] Update item response", response.data);

        const updated = normalizeItem(
          response.data?.data ||
            response.data?.menuItem ||
            response.data?.item ||
            response.data
        );

        setItems((prev) => prev.map((item) => (item._id === itemId ? updated : item)));
        addToast({
          title: "Success",
          message: "Item updated successfully",
          type: "success",
        });
      } else {
        const payload = {
          ...basePayload,
          isAvailable: true,
        };

        console.log("[Categories] Add item payload", payload);
        const response = await api.post("/api/owner/menu-items", payload);
        console.log("[Categories] Add item response", response.data);

        const created = normalizeItem(
          response.data?.data ||
            response.data?.menuItem ||
            response.data?.item ||
            response.data
        );

        setItems((prev) => [created, ...prev]);
        addToast({
          title: "Success",
          message: "Item added successfully",
          type: "success",
        });
      }

      setFormModalOpen(false);
      setEditingItem(null);
      setItemForm(createInitialForm(selectedCategoryId));

      await fetchCategories();
      await fetchItemsByCategory(
        selectedCategory,
        { showLoading: false }
      );
    } catch (error) {
      console.log("Add item error status:", error?.response?.status ?? error?.status);
      console.log("Add item error response:", error?.response?.data ?? error?.data);
      console.error("[Categories] Save item failed", {
        payload: {
          name: itemForm.name.trim(),
          categoryId: selectedCategory?._id || "",
          price: Number(itemForm.price),
          imageUrl: itemForm.imageUrl || "",
          description: itemForm.description?.trim() || "",
          isVeg: Boolean(itemForm.isVeg),
          isAvailable: Boolean(itemForm.isAvailable),
          isActive: true,
        },
        errorResponse: error?.response?.data,
        error,
      });
      addToast({
        title: "Action failed",
        message:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.data?.message ||
          error?.data?.error ||
          getErrorMessage(error, "Failed to add item"),
        type: "error",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget?._id || !selectedCategoryId) {
      return;
    }

    try {
      setDeleteSubmitting(true);
      console.log("[Categories] Delete item id", deleteTarget._id);
      const response = await api.delete(`/api/owner/menu-items/${deleteTarget._id}`);
      console.log("[Categories] Delete item response", response.data);

      setItems((prev) => prev.filter((item) => item._id !== deleteTarget._id));
      setDeleteTarget(null);
      addToast({
        title: "Success",
        message: "Item removed from menu",
        type: "success",
      });

      await fetchCategories();
      await fetchItemsByCategory(
        selectedCategory || { _id: selectedCategoryId, sourceCategoryIds: [selectedCategoryId] },
        { showLoading: false }
      );
    } catch (error) {
      console.error("[Categories] Delete item failed", {
        id: deleteTarget?._id,
        errorResponse: error?.response?.data,
        error,
      });
      addToast({
        title: "Delete failed",
        message:
          error?.response?.data?.message ||
          getErrorMessage(error, "Unable to remove this item"),
        type: "error",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const hasCategories = categories.length > 0;

  return (
    <div className="page-stack categories-page">
      <section className="panel categories-panel">
        <div className="categories-title-block">
          <h2>Menu Categories</h2>
          <p>Manage items category-wise</p>
        </div>

        {categoriesLoading ? (
          <CategoriesSkeleton />
        ) : categoriesError ? (
          <div className="error-panel">
            <p className="error-msg">{categoriesError}</p>
            <button className="btn ghost" type="button" onClick={() => void fetchCategories()}>
              Retry
            </button>
          </div>
        ) : (
          <div className="category-scroll" role="tablist" aria-label="Menu categories">
            {categories.map((category, index) => (
              <CategoryCard
                key={category._id}
                category={category}
                index={index}
                count={itemCountMap[category._id] ?? category.itemCount}
                isActive={selectedCategoryId === category._id}
                onSelect={handleCategorySelect}
                onEdit={openEditCategoryModal}
              />
            ))}
            <AddCategoryCard onClick={openAddCategoryModal} />
          </div>
        )}
      </section>

      {hasCategories && selectedCategory && (
        <section className="panel category-items-panel">
          <div className="panel-head category-items-head">
            <div>
              <h3>{selectedCategory.name} Items</h3>
              <p className="muted">Edit, add or remove menu items in this category.</p>
            </div>

            <div className="category-action-row">
              <button
                type="button"
                className="btn"
                onClick={handleOpenAddModal}
                disabled={deleteMode}
              >
                + Add Item
              </button>

              <button
                type="button"
                className={`btn ${deleteMode ? "ghost" : "danger"}`}
                onClick={() => setDeleteMode((prev) => !prev)}
              >
                {deleteMode ? "Cancel Delete" : "Delete Items"}
              </button>
            </div>
          </div>

          <div className="item-filter-row" role="tablist" aria-label="Menu type filter">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`filter-pill ${typeFilter === filter.key ? "active" : ""}`}
                onClick={() => setTypeFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {itemsLoading ? (
            <ItemsSkeleton />
          ) : itemsError ? (
            <div className="error-panel">
              <p className="error-msg">Failed to load items. Retry</p>
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  void fetchItemsByCategory(
                    selectedCategory || {
                      _id: selectedCategoryId,
                      sourceCategoryIds: [selectedCategoryId],
                    }
                  )
                }
              >
                Retry
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="category-empty-state">
              <p className="muted">
                {items.length === 0 && typeFilter === "all"
                  ? ["Soups", "Starters", "Rice"].includes(selectedCategory?.name)
                    ? "Backend returned 0 items for this category. Please check backend category migration."
                    : "No items in this category yet."
                  : "No items found for this filter."}
              </p>
              <button className="btn" type="button" onClick={handleOpenAddModal}>
                + Add first item
              </button>
            </div>
          ) : (
            <div className="menu-items-grid">
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item._id}
                  item={item}
                  deleteMode={deleteMode}
                  onEdit={handleOpenEditModal}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <AddCategoryModal
        isOpen={addCategoryModalOpen}
        name={newCategoryName}
        file={newCategoryImageFile}
        saving={categorySaving}
        uploading={categoryUploading}
        onClose={closeAddCategoryModal}
        onSubmit={handleCreateCategory}
        onNameChange={setNewCategoryName}
        onFileChange={setNewCategoryImageFile}
      />

      <EditCategoryModal
        isOpen={editCategoryModalOpen}
        name={editCategoryName}
        imageUrl={editCategoryImageUrl}
        file={editCategoryImageFile}
        saving={editCategorySaving}
        deleting={categoryDeleting}
        uploading={editCategoryUploading}
        onClose={closeEditCategoryModal}
        onSubmit={handleSaveCategoryChanges}
        onNameChange={setEditCategoryName}
        onFileChange={setEditCategoryImageFile}
        onDeleteClick={() => setDeleteCategoryConfirmOpen(true)}
      />

      <Modal
        isOpen={deleteCategoryConfirmOpen}
        title="Delete category?"
        description="Are you sure you want to remove this category from the menu? All items under this category will no longer be visible to customers."
        cancelText="No, keep category"
        confirmText={categoryDeleting ? "Deleting..." : "Yes, delete category"}
        onCancel={() => setDeleteCategoryConfirmOpen(false)}
        onConfirm={() => void handleDeleteCategory()}
        loading={categoryDeleting}
      />

      <ItemFormModal
        isOpen={formModalOpen}
        mode={modalMode}
        categoryName={selectedCategory?.name || "Selected Category"}
        form={itemForm}
        submitting={formSubmitting}
        supportsAvailability={supportsAvailability}
        onClose={closeItemModal}
        onSubmit={handleSaveItem}
        onChange={handleChangeItemForm}
      />

      <Modal
        isOpen={!!deleteTarget}
        title="Remove Menu Item"
        description="Are you sure you want to remove this item from the menu? Customers will no longer see this item in the app."
        cancelText="No, keep item"
        confirmText="Yes, remove item"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteItem()}
        loading={deleteSubmitting}
      />
    </div>
  );
}
