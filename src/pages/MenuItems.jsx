import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api, { getErrorMessage } from "../services/api";
import { formatCurrency } from "../services/formatters";

const FINAL_CATEGORY_ORDER = [
  "Biryani",
  "Soups",
  "Starters",
  "Fried Chicken",
  "Rice",
  "Noodles",
];

const CATEGORY_ALIAS_RULES = [
  [/^biryani'?s?$/i, "Biryani"],
  [/^biryanis$/i, "Biryani"],
  [/^soups?$/i, "Soups"],
  [/^veg soups?$/i, "Soups"],
  [/^non[\\s-]?veg soups?$/i, "Soups"],
  [/^starters?$/i, "Starters"],
  [/^veg starters?$/i, "Starters"],
  [/^non[\\s-]?veg starters?$/i, "Starters"],
  [/^fried chicken$/i, "Fried Chicken"],
  [/^rice$/i, "Rice"],
  [/^veg rice$/i, "Rice"],
  [/^non[\\s-]?veg rice$/i, "Rice"],
  [/^noodles$/i, "Noodles"],
  [/^veg[\\s-]*-?[\\s-]*non[\\s-]?veg noodles$/i, "Noodles"],
];

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "veg", label: "Veg" },
  { key: "non-veg", label: "Non-Veg" },
];

const resolveCanonicalCategoryName = (value) => {
  const raw = String(value || "").trim();

  for (const [pattern, name] of CATEGORY_ALIAS_RULES) {
    if (pattern.test(raw)) {
      return name;
    }
  }

  return null;
};

const getListFromResponse = (response, keys = []) => {
  const data = response?.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }

    if (Array.isArray(data?.data?.[key])) {
      return data.data[key];
    }
  }

  return [];
};

const normalizeCategory = (category) => {
  const canonicalName = resolveCanonicalCategoryName(category?.name || "");

  return {
    ...category,
    _id: category?._id || category?.id || "",
    name: canonicalName || category?.name || "",
    canonicalName,
    isActive: category?.isActive !== false,
  };
};

const normalizeItem = (item) => {
  const resolvedCategoryName =
    item?.categoryId?.name || item?.category?.name || item?.categoryName || "";
  const canonicalCategoryName = resolveCanonicalCategoryName(resolvedCategoryName);

  return {
    _id: item?._id || item?.id || "",
    name: item?.name || "",
    categoryId: item?.categoryId?._id || item?.categoryId || "",
    categoryName: resolvedCategoryName,
    canonicalCategoryName,
    price: Number(item?.price) || 0,
    imageUrl: item?.imageUrl || item?.image || "",
    isVeg: item?.isVeg === true,
    isAvailable: item?.isAvailable !== false,
    isActive: item?.isActive !== false,
  };
};

function MenuItemAvailabilityCard({ item, onToggleAvailability, pending }) {
  return (
    <article className={`menu-availability-card ${item.isAvailable ? "" : "unavailable"}`}>
      <div className="menu-availability-media">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" />
        ) : (
          <div className="menu-availability-placeholder">
            <span>{item.name.slice(0, 1).toUpperCase() || "M"}</span>
          </div>
        )}
      </div>

      <div className="menu-availability-content">
        <h4>{item.name}</h4>
        <p className="menu-availability-price">{formatCurrency(item.price)}</p>

        <div className="menu-availability-badges">
          <span className={`badge ${item.isVeg ? "veg" : "non-veg"}`}>
            {item.isVeg ? "Veg" : "Non-Veg"}
          </span>
          <span className={`badge ${item.isAvailable ? "available" : "unavailable"}`}>
            {item.isAvailable ? "Available" : "Unavailable"}
          </span>
        </div>

        <div className="availability-toggle-row">
          <button
            type="button"
            className={`btn ${item.isAvailable ? "success" : "ghost"}`}
            disabled={pending}
            onClick={() => onToggleAvailability(item, true)}
          >
            Available
          </button>
          <button
            type="button"
            className={`btn ${!item.isAvailable ? "danger" : "ghost"}`}
            disabled={pending}
            onClick={() => onToggleAvailability(item, false)}
          >
            Unavailable
          </button>
        </div>
      </div>
    </article>
  );
}

function MenuItemsSkeleton() {
  return (
    <div className="menu-availability-skeleton-wrap" aria-hidden="true">
      {[1, 2, 3].map((section) => (
        <section className="panel" key={section}>
          <div className="menu-availability-section-title-skeleton" />
          <div className="menu-availability-filter-skeleton-row">
            <div />
            <div />
            <div />
          </div>
          <div className="menu-items-grid">
            {[1, 2, 3].map((card) => (
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
        </section>
      ))}
    </div>
  );
}

export default function MenuItems() {
  const outletContext = useOutletContext();
  const addToast = outletContext?.addToast || (() => {});

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState({});
  const [pendingItemIds, setPendingItemIds] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [categoriesResponse, itemsResponse] = await Promise.all([
        api.get("/api/owner/categories"),
        api.get("/api/owner/menu-items"),
      ]);

      const categoriesList = getListFromResponse(categoriesResponse, ["categories"])
        .map(normalizeCategory)
        .filter(
          (category) =>
            category._id &&
            category.isActive &&
            FINAL_CATEGORY_ORDER.includes(category.name)
        );

      const dedupedCategories = FINAL_CATEGORY_ORDER.map((name) => {
        return categoriesList.find((category) => category.name === name) || null;
      }).filter(Boolean);

      const normalizedItems = getListFromResponse(itemsResponse, ["menuItems", "items"])
        .map(normalizeItem)
        .filter(
          (item) =>
            item._id &&
            item.isActive &&
            item.canonicalCategoryName &&
            FINAL_CATEGORY_ORDER.includes(item.canonicalCategoryName)
        );

      setCategories(dedupedCategories);
      setItems(normalizedItems);

      const categoryNames = new Set([
        ...dedupedCategories.map((category) => category.name),
        ...normalizedItems.map((item) => item.canonicalCategoryName),
      ]);

      setCategoryFilters((prev) => {
        const next = {};
        for (const name of FINAL_CATEGORY_ORDER) {
          if (categoryNames.has(name)) {
            next[name] = prev[name] || "all";
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load menu items. Retry"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const searchTerm = searchQuery.trim().toLowerCase();

  const searchedItems = useMemo(() => {
    if (!searchTerm) {
      return items;
    }

    return items.filter((item) => {
      const searchable = [
        item.name,
        item.categoryName,
        item.canonicalCategoryName,
        String(item.price),
        item.isVeg ? "veg" : "non-veg",
        item.isVeg ? "vegetarian" : "non vegetarian",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(searchTerm);
    });
  }, [items, searchTerm]);

  const categoryOrderToRender = useMemo(() => {
    const availableCategoryNames = new Set([
      ...categories.map((category) => category.name),
      ...items.map((item) => item.canonicalCategoryName),
    ]);

    const base = FINAL_CATEGORY_ORDER.filter((name) => availableCategoryNames.has(name));

    if (!searchTerm) {
      return base;
    }

    const withSearchResults = new Set(searchedItems.map((item) => item.canonicalCategoryName));
    return base.filter((name) => withSearchResults.has(name));
  }, [categories, items, searchTerm, searchedItems]);

  const groupedItems = useMemo(() => {
    const grouped = {};

    for (const name of FINAL_CATEGORY_ORDER) {
      grouped[name] = [];
    }

    for (const item of searchedItems) {
      if (!item.canonicalCategoryName) {
        continue;
      }

      if (!grouped[item.canonicalCategoryName]) {
        grouped[item.canonicalCategoryName] = [];
      }

      grouped[item.canonicalCategoryName].push(item);
    }

    return grouped;
  }, [searchedItems]);

  const handleCategoryFilterChange = (categoryName, filterKey) => {
    setCategoryFilters((prev) => ({
      ...prev,
      [categoryName]: filterKey,
    }));
  };

  const isItemPending = (itemId) => pendingItemIds.includes(itemId);

  const handleToggleAvailability = async (item, nextAvailability) => {
    if (!item?._id || item.isAvailable === nextAvailability) {
      return;
    }

    const itemId = item._id;
    const previousAvailability = item.isAvailable;

    setPendingItemIds((prev) => [...prev, itemId]);
    setItems((prev) =>
      prev.map((row) =>
        row._id === itemId ? { ...row, isAvailable: nextAvailability } : row
      )
    );

    try {
      const response = await api.patch(`/api/owner/menu-items/${itemId}`, {
        isAvailable: nextAvailability,
      });

      const normalized = normalizeItem(
        response.data?.data ||
          response.data?.menuItem ||
          response.data?.item ||
          response.data
      );

      if (normalized?._id) {
        setItems((prev) =>
          prev.map((row) =>
            row._id === itemId ? { ...row, ...normalized } : row
          )
        );
      }

      addToast({
        title: "Success",
        message: nextAvailability
          ? "Item marked as available"
          : "Item marked as unavailable",
        type: "success",
      });
    } catch (toggleError) {
      console.log("Availability update error:", toggleError?.response?.data || toggleError);
      setItems((prev) =>
        prev.map((row) =>
          row._id === itemId ? { ...row, isAvailable: previousAvailability } : row
        )
      );

      addToast({
        title: "Update failed",
        message:
          toggleError?.response?.data?.message ||
          toggleError?.data?.message ||
          getErrorMessage(toggleError, "Failed to update item availability"),
        type: "error",
      });
    } finally {
      setPendingItemIds((prev) => prev.filter((id) => id !== itemId));
    }
  };

  const searchHasNoResults = Boolean(searchTerm) && searchedItems.length === 0;

  return (
    <div className="page-stack menu-availability-page">
      <section className="panel menu-availability-hero">
        <h2>Menu Availability</h2>
        <p>Manage which items are currently available for customers</p>

        <input
          className="menu-availability-search"
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search menu items..."
        />
      </section>

      {loading ? (
        <MenuItemsSkeleton />
      ) : error ? (
        <section className="panel error-panel">
          <p className="error-msg">Failed to load menu items. Retry</p>
          <button className="btn ghost" type="button" onClick={() => void loadData()}>
            Retry
          </button>
        </section>
      ) : searchHasNoResults ? (
        <section className="panel">
          <p className="muted">No menu items found.</p>
        </section>
      ) : (
        <div className="menu-availability-sections">
          {categoryOrderToRender.map((categoryName) => {
            const categoryItems = groupedItems[categoryName] || [];
            const filter = categoryFilters[categoryName] || "all";

            const visibleItems = categoryItems.filter((item) => {
              if (filter === "veg") {
                return item.isVeg === true;
              }

              if (filter === "non-veg") {
                return item.isVeg === false;
              }

              return true;
            });

            return (
              <section className="panel menu-availability-section" key={categoryName}>
                <div className="menu-availability-section-head">
                  <h3>{categoryName}</h3>
                  <span className="muted">{categoryItems.length} items</span>
                </div>

                <div className="item-filter-row" role="tablist" aria-label={`${categoryName} type filter`}>
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`filter-pill ${filter === option.key ? "active" : ""}`}
                      onClick={() => handleCategoryFilterChange(categoryName, option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {categoryItems.length === 0 ? (
                  <p className="muted">No items in this category.</p>
                ) : visibleItems.length === 0 ? (
                  <p className="muted">No items found for this filter.</p>
                ) : (
                  <div className="menu-items-grid">
                    {visibleItems.map((item) => (
                      <MenuItemAvailabilityCard
                        key={item._id}
                        item={item}
                        pending={isItemPending(item._id)}
                        onToggleAvailability={handleToggleAvailability}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
