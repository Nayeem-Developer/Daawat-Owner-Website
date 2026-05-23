import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Modal from "../components/Modal";
import api, { getErrorMessage, uploadImage } from "../services/api";
import { formatCurrency } from "../services/formatters";

const createInitialForm = () => ({
  title: "",
  description: "",
  imageUrl: "",
  imageFile: null,
  menuItemId: "",
  buttonText: "Order Now",
  displayOrder: "0",
  isActive: true,
});

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

const normalizeMenuItem = (item) => ({
  _id: item?._id || item?.id || "",
  name: item?.name || "",
  categoryName:
    item?.categoryId?.name ||
    item?.category?.name ||
    item?.categoryName ||
    "Category",
  price: Number(item?.price || 0),
  isVeg: item?.isVeg === true,
  isAvailable: item?.isAvailable !== false,
});

const normalizeBanner = (banner) => ({
  ...banner,
  _id: banner?._id || banner?.id || "",
  title: banner?.title || banner?.name || "",
  description: banner?.description || "",
  imageUrl: banner?.imageUrl || banner?.image || "",
  menuItemId:
    banner?.menuItemId?._id ||
    banner?.menuItem?._id ||
    banner?.menuItemId ||
    "",
  linkedMenuItemName:
    banner?.menuItemId?.name ||
    banner?.menuItem?.name ||
    banner?.menuItemName ||
    "No item linked",
  buttonText: banner?.buttonText || "Order Now",
  displayOrder: Number(banner?.displayOrder || 0),
  isActive: banner?.isActive !== false,
});

function BannerFormModal({
  isOpen,
  mode,
  form,
  menuItems,
  submitting,
  uploading,
  onClose,
  onSubmit,
  onChange,
}) {
  const [menuItemSearchText, setMenuItemSearchText] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setMenuItemSearchText("");
    }
  }, [isOpen]);

  useEffect(() => {
    console.log("Menu item search:", menuItemSearchText);
  }, [menuItemSearchText]);

  const previewImageUrl = useMemo(() => {
    if (form.imageFile) {
      return URL.createObjectURL(form.imageFile);
    }
    return form.imageUrl || "";
  }, [form.imageFile, form.imageUrl]);

  useEffect(() => {
    if (!form.imageFile || !previewImageUrl) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(previewImageUrl);
    };
  }, [form.imageFile, previewImageUrl]);

  const filteredMenuItems = useMemo(() => {
    const term = menuItemSearchText.trim().toLowerCase();
    if (!term) {
      return menuItems;
    }

    return menuItems.filter((item) => {
      const searchable = [
        item.name,
        item.categoryName,
        String(item.price || 0),
        item.isVeg ? "veg" : "non-veg",
        item.isAvailable ? "available" : "unavailable",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [menuItems, menuItemSearchText]);

  useEffect(() => {
    console.log("Filtered linked menu items:", filteredMenuItems.length);
  }, [filteredMenuItems.length]);

  const selectedMenuItem = useMemo(
    () => menuItems.find((item) => item._id === form.menuItemId) || null,
    [menuItems, form.menuItemId]
  );

  useEffect(() => {
    console.log("Selected linked menu item:", selectedMenuItem);
  }, [selectedMenuItem]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card banner-form-modal">
        <div className="item-form-head">
          <h3>{mode === "edit" ? "Edit Banner" : "Add New Banner"}</h3>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            disabled={submitting || uploading}
          >
            Close
          </button>
        </div>

        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            Banner title
            <input
              value={form.title}
              onChange={(event) => onChange("title", event.target.value)}
              placeholder="Fresh Deals This Week"
              required
            />
          </label>

          <label>
            Description
            <textarea
              rows="2"
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Hot and delicious menu picks for today"
            />
          </label>

          <div className="item-upload-row">
            <label>
              Banner image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onChange("imageFile", event.target.files?.[0] || null)}
              />
            </label>
            <div className="item-image-preview">
              {previewImageUrl ? (
                <img src={previewImageUrl} alt="Banner preview" />
              ) : (
                <div className="menu-item-fallback">
                  <span>B</span>
                </div>
              )}
            </div>
          </div>

          <div className="banner-menu-selector">
            <label>
              Linked menu item
              <input
                className="banner-menu-search"
                type="text"
                value={menuItemSearchText}
                onChange={(event) => setMenuItemSearchText(event.target.value)}
                placeholder="Search menu item..."
              />
            </label>

            <div className="banner-menu-options" role="listbox" aria-label="Linked menu items">
              {filteredMenuItems.length === 0 ? (
                <p className="banner-menu-empty">No menu items found.</p>
              ) : (
                filteredMenuItems.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`banner-menu-option ${
                      form.menuItemId === item._id ? "selected" : ""
                    }`}
                    onClick={() => onChange("menuItemId", item._id)}
                  >
                    <span className="banner-menu-option-name">
                      {item.name} - {formatCurrency(item.price)}
                    </span>
                    <span className="banner-menu-option-meta">
                      {item.categoryName} • {item.isVeg ? "Veg" : "Non-Veg"} •{" "}
                      {item.isAvailable ? "Available" : "Unavailable"}
                    </span>
                  </button>
                ))
              )}
            </div>

            <p className="banner-menu-selected">
              {selectedMenuItem
                ? `Selected: ${selectedMenuItem.name} - ${formatCurrency(
                    selectedMenuItem.price
                  )}`
                : "Selected: None"}
            </p>
          </div>

          <div className="banner-form-meta-grid">
            <label>
              Button text
              <input
                value={form.buttonText}
                onChange={(event) => onChange("buttonText", event.target.value)}
                placeholder="Order Now"
              />
            </label>
            <label>
              Display order
              <input
                type="number"
                min="0"
                step="1"
                value={form.displayOrder}
                onChange={(event) => onChange("displayOrder", event.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          <label className="check-row availability-check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => onChange("isActive", event.target.checked)}
            />
            Active banner
          </label>

          {uploading ? <p className="category-uploading-note">Uploading image...</p> : null}

          <div className="banner-mobile-preview">
            <div className="banner-mobile-preview-media">
              {previewImageUrl ? (
                <img src={previewImageUrl} alt="Mobile banner preview" />
              ) : (
                <div className="menu-item-fallback">
                  <span>P</span>
                </div>
              )}
            </div>
            <div className="banner-mobile-preview-content">
              <h4>{form.title || "Banner title preview"}</h4>
              <p>{form.description || "Banner description preview"}</p>
              <button type="button" className="btn">
                {form.buttonText?.trim() || "Order Now"}
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={submitting || uploading}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={submitting || uploading}>
              {submitting ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Banner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BannerCard({ banner, linkedItemName, onEdit, onDelete }) {
  return (
    <article className="banner-card">
      <div className="banner-card-media">
        {banner.imageUrl ? (
          <img src={banner.imageUrl} alt={banner.title} loading="lazy" />
        ) : (
          <div className="menu-item-fallback">
            <span>B</span>
          </div>
        )}
      </div>
      <div className="banner-card-content">
        <h4>{banner.title || "Untitled banner"}</h4>
        <p className="banner-card-description">{banner.description || "No description"}</p>
        <p className="banner-card-meta">
          Linked item: <strong>{linkedItemName}</strong>
        </p>
        <p className="banner-card-meta">Display order: {banner.displayOrder}</p>
        <div className="menu-item-badges">
          <span className={`badge ${banner.isActive ? "available" : "unavailable"}`}>
            {banner.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="banner-card-actions">
          <button type="button" className="btn ghost" onClick={() => onEdit(banner)}>
            Edit
          </button>
          <button type="button" className="btn danger" onClick={() => onDelete(banner)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Banners() {
  const outletContext = useOutletContext();
  const addToast = outletContext?.addToast || (() => {});

  const [banners, setBanners] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formUploading, setFormUploading] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerForm, setBannerForm] = useState(createInitialForm);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [bannersResponse, menuItemsResponse] = await Promise.all([
        api.get("/api/owner/banners"),
        api.get("/api/owner/menu-items"),
      ]);

      const bannersResponseBody = bannersResponse?.data;
      const rawBanners = getListFromResponseBody(bannersResponseBody, ["banners"]);
      console.log("Owner panel API response:", bannersResponseBody);
      console.log("Parsed items:", rawBanners.length);
      const nextBanners = rawBanners.map(normalizeBanner);
      const activeBanners = nextBanners.filter((banner) => banner.isActive !== false);

      const menuItemsResponseBody = menuItemsResponse?.data;
      const rawMenuItems = getListFromResponseBody(menuItemsResponseBody, [
        "menuItems",
        "items",
      ]);
      console.log("Owner panel API response:", menuItemsResponseBody);
      console.log("Parsed items:", rawMenuItems.length);
      const nextMenuItems = rawMenuItems.map(normalizeMenuItem);

      setBanners(activeBanners);
      setMenuItems(nextMenuItems);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load banners. Retry"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  const menuItemNameById = useMemo(() => {
    const lookup = new Map();
    for (const item of menuItems) {
      lookup.set(item._id, item.name);
    }
    return lookup;
  }, [menuItems]);

  const openAddModal = () => {
    setFormMode("add");
    setEditingBanner(null);
    setBannerForm(createInitialForm());
    setFormModalOpen(true);
  };

  const openEditModal = (banner) => {
    setFormMode("edit");
    setEditingBanner(banner);
    setBannerForm({
      title: banner.title || "",
      description: banner.description || "",
      imageUrl: banner.imageUrl || "",
      imageFile: null,
      menuItemId: banner.menuItemId || "",
      buttonText: banner.buttonText || "Order Now",
      displayOrder: String(banner.displayOrder ?? 0),
      isActive: banner.isActive !== false,
    });
    setFormModalOpen(true);
  };

  const closeFormModal = () => {
    if (formSubmitting || formUploading) {
      return;
    }
    setFormModalOpen(false);
    setEditingBanner(null);
    setBannerForm(createInitialForm());
  };

  const resetAndCloseFormModal = () => {
    setFormModalOpen(false);
    setEditingBanner(null);
    setBannerForm(createInitialForm());
  };

  const handleFormChange = (field, value) => {
    setBannerForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveBanner = async (event) => {
    event.preventDefault();

    const trimmedTitle = bannerForm.title.trim();
    if (!trimmedTitle) {
      addToast({
        title: "Validation",
        message: "Please enter banner title",
        type: "error",
      });
      return;
    }

    if (!bannerForm.menuItemId) {
      addToast({
        title: "Validation",
        message: "Please select a menu item",
        type: "error",
      });
      return;
    }

    try {
      setFormSubmitting(true);
      let uploadedImageUrl = bannerForm.imageUrl || "";

      if (bannerForm.imageFile) {
        setFormUploading(true);
        try {
          uploadedImageUrl = await uploadImage(bannerForm.imageFile);
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
          setFormUploading(false);
        }
      }

      if (!uploadedImageUrl) {
        addToast({
          title: "Validation",
          message: "Please upload banner image",
          type: "error",
        });
        return;
      }

      const payload = {
        title: trimmedTitle,
        description: bannerForm.description.trim(),
        imageUrl: uploadedImageUrl,
        menuItemId: bannerForm.menuItemId,
        buttonText: bannerForm.buttonText?.trim() || "Order Now",
        displayOrder: Number(bannerForm.displayOrder) || 0,
        isActive: Boolean(bannerForm.isActive),
      };
      console.log("Banner payload:", payload);

      if (formMode === "edit" && editingBanner?._id) {
        await api.patch(`/api/owner/banners/${editingBanner._id}`, payload);
        addToast({
          title: "Success",
          message: "Banner updated successfully",
          type: "success",
        });
      } else {
        await api.post("/api/owner/banners", payload);
        addToast({
          title: "Success",
          message: "Banner added successfully",
          type: "success",
        });
      }

      resetAndCloseFormModal();
      await fetchData();
    } catch (saveError) {
      addToast({
        title: "Save failed",
        message:
          saveError?.response?.data?.message ||
          saveError?.data?.message ||
          "Failed to save banner",
        type: "error",
      });
    } finally {
      setFormSubmitting(false);
      setFormUploading(false);
    }
  };

  const handleDeleteBanner = async () => {
    if (!deleteTarget?._id) {
      return;
    }

    try {
      setDeleteLoading(true);
      const deletedId = deleteTarget._id;
      const response = await api.delete(`/api/owner/banners/${deletedId}`);
      console.log("Delete banner response:", response.data);
      setBanners((prev) => prev.filter((banner) => banner._id !== deletedId));
      setDeleteTarget(null);
      await fetchData();
      addToast({
        title: "Success",
        message: "Banner removed successfully",
        type: "success",
      });
    } catch (deleteError) {
      addToast({
        title: "Delete failed",
        message:
          deleteError?.response?.data?.message ||
          deleteError?.data?.message ||
          "Failed to remove banner",
        type: "error",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="page-stack banner-page">
      <section className="panel banner-hero">
        <div className="banner-hero-head">
          <div>
            <h2>Home Banners</h2>
            <p>Manage mobile app home carousel slides</p>
          </div>
          <button type="button" className="btn" onClick={openAddModal}>
            + Add Banner
          </button>
        </div>
      </section>

      {loading ? (
        <section className="panel">
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
      ) : error ? (
        <section className="panel error-panel">
          <p className="error-msg">Failed to load banners. Retry</p>
          <button type="button" className="btn ghost" onClick={() => void fetchData()}>
            Retry
          </button>
        </section>
      ) : banners.length === 0 ? (
        <section className="panel">
          <p className="muted">No banners added yet.</p>
        </section>
      ) : (
        <section className="panel">
          <div className="banner-grid">
            {banners.map((banner) => (
              <BannerCard
                key={banner._id}
                banner={banner}
                linkedItemName={menuItemNameById.get(banner.menuItemId) || banner.linkedMenuItemName}
                onEdit={openEditModal}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        </section>
      )}

      <BannerFormModal
        isOpen={formModalOpen}
        mode={formMode}
        form={bannerForm}
        menuItems={menuItems}
        submitting={formSubmitting}
        uploading={formUploading}
        onClose={closeFormModal}
        onSubmit={handleSaveBanner}
        onChange={handleFormChange}
      />

      <Modal
        isOpen={!!deleteTarget}
        title="Delete Banner?"
        description="Are you sure you want to remove this banner from the mobile app home page?"
        cancelText="Cancel"
        confirmText="Delete"
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteBanner()}
      />
    </div>
  );
}
