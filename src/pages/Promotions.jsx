import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api, {
  deletePromoCampaign,
  getErrorMessage,
  getListFromResponseBody,
  getPromoCampaigns,
  savePromoCampaign,
  sendPromoNotification,
  togglePromoCampaign,
} from "../services/api";
import { formatDateTime } from "../services/formatters";

const DEFAULT_TIMES = {
  lunch: "12:30 PM",
  dinner: "7:30 PM",
};

const TIMEZONE = "Asia/Kolkata";

const createSendForm = () => ({
  title: "",
  body: "",
  imageUrl: "",
  itemId: "",
  categoryId: "",
});

const createScheduleForm = () => ({
  campaignType: "lunch",
  title: "",
  body: "",
  imageUrl: "",
  itemId: "",
  categoryId: "",
  scheduledTime: DEFAULT_TIMES.lunch,
  isActive: true,
});

const normalizeMenuItem = (item) => ({
  _id: item?._id || item?.id || "",
  name: item?.name || "",
  categoryId: item?.categoryId?._id || item?.category?._id || item?.categoryId || "",
  categoryName:
    item?.categoryId?.name || item?.category?.name || item?.categoryName || "Menu",
  imageUrl: item?.imageUrl || item?.image || "",
  isAvailable: item?.isAvailable !== false,
  isActive: item?.isActive !== false,
});

const normalizeCampaign = (campaign) => {
  const campaignType =
    campaign?.campaignType || campaign?.scheduleType || campaign?.type || "";
  const scheduledTime =
    campaign?.scheduledTime || campaign?.time || campaign?.scheduleTime || "";

  return {
    ...campaign,
    _id: campaign?._id || campaign?.id || "",
    title: campaign?.title || "Promotion",
    body: campaign?.body || campaign?.message || "",
    imageUrl: campaign?.imageUrl || campaign?.image || "",
    campaignType: String(campaignType || "").trim().toLowerCase(),
    scheduledTime: String(scheduledTime || "").trim(),
    isActive: campaign?.isActive ?? campaign?.active ?? false,
    lastSentAt: campaign?.lastSentAt || campaign?.lastSent || campaign?.sentAt || "",
  };
};

const capitalize = (value) => {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Daily";
};

const validatePromotion = (form, { requireTime = false } = {}) => {
  const title = form.title.trim();
  const body = form.body.trim();
  const imageUrl = form.imageUrl.trim();

  if (!title) {
    return "Notification title is required.";
  }

  if (title.length > 80) {
    return "Title must be 80 characters or less.";
  }

  if (!body) {
    return "Message is required.";
  }

  if (body.length > 180) {
    return "Message must be 180 characters or less.";
  }

  if (imageUrl && !imageUrl.startsWith("https://")) {
    return "Image URL must start with https://";
  }

  if (requireTime && !form.scheduledTime.trim()) {
    return "Schedule time is required.";
  }

  return "";
};

const getSuccessCount = (response) =>
  response?.successCount ??
  response?.sentCount ??
  response?.tokensSent ??
  response?.tokenCount ??
  response?.data?.successCount ??
  response?.data?.sentCount ??
  response?.data?.tokensSent ??
  response?.data?.tokenCount ??
  null;

function NotificationPreview({ title, body, imageUrl }) {
  return (
    <div className="promotions-preview-card">
      <div className="promotions-preview-copy">
        <h4>{title || "Lunch Special"}</h4>
        <p>{body || "Fresh Dum Biryani is ready. Order now!"}</p>
      </div>
      {imageUrl ? (
        <div className="promotions-preview-media">
          <img src={imageUrl} alt={title || "Promotion preview"} />
        </div>
      ) : null}
      <span className="promotions-preview-note">
        This will be sent to customers who allowed notifications.
      </span>
    </div>
  );
}

function MenuItemSelector({ items, selectedItemId, onSelect }) {
  if (items.length === 0) {
    return <p className="muted">No menu items available.</p>;
  }

  return (
    <div className="promotions-item-grid">
      {items.map((item) => (
        <button
          key={item._id}
          type="button"
          className={`promotions-item-chip ${selectedItemId === item._id ? "selected" : ""}`}
          onClick={() => onSelect(item)}
        >
          <strong>{item.name}</strong>
          <span>{item.categoryName}</span>
        </button>
      ))}
    </div>
  );
}

function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText,
  cancelText = "Cancel",
  loading = false,
  danger = false,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "danger" : ""}`.trim()}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Promotions() {
  const outletContext = useOutletContext();
  const addToast = outletContext?.addToast || (() => {});

  const [menuItems, setMenuItems] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [sendForm, setSendForm] = useState(createSendForm());
  const [scheduleForm, setScheduleForm] = useState(createScheduleForm());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState("");
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const visibleMenuItems = useMemo(
    () =>
      menuItems
        .map(normalizeMenuItem)
        .filter((item) => item._id && item.name && item.isActive && item.isAvailable),
    [menuItems]
  );

  const loadData = useCallback(
    async () => {
      try {
        setLoadError("");

        const [itemsResult, campaignsResult] = await Promise.allSettled([
          api.get("/api/owner/menu-items"),
          getPromoCampaigns(),
        ]);

        if (itemsResult.status === "fulfilled") {
          setMenuItems(getListFromResponseBody(itemsResult.value?.data, ["menuItems", "items"]));
        }

        if (campaignsResult.status === "fulfilled") {
          setCampaigns((campaignsResult.value || []).map(normalizeCampaign));
        }

        const firstError =
          [itemsResult, campaignsResult]
            .filter((result) => result.status === "rejected")
            .map((result) => result.reason)
            .find(Boolean) || null;

        if (firstError) {
          const message = getErrorMessage(firstError, "Unable to load promotions right now.");
          setLoadError(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const applyMenuItemToSendForm = (item) => {
    setSendForm((current) => ({
      ...current,
      itemId: item._id,
      categoryId: item.categoryId,
      title: current.title.trim() ? current.title : `Try ${item.name} today`,
      imageUrl: current.imageUrl.trim() ? current.imageUrl : item.imageUrl,
    }));
  };

  const applyMenuItemToScheduleForm = (item) => {
    setScheduleForm((current) => ({
      ...current,
      itemId: item._id,
      categoryId: item.categoryId,
      title: current.title.trim() ? current.title : `Try ${item.name} today`,
      imageUrl: current.imageUrl.trim() ? current.imageUrl : item.imageUrl,
    }));
  };

  const handleCampaignTypeChange = (campaignType) => {
    setScheduleForm((current) => ({
      ...current,
      campaignType,
      scheduledTime: DEFAULT_TIMES[campaignType],
    }));
  };

  const handleSendNowClick = () => {
    const validationError = validatePromotion(sendForm);
    if (validationError) {
      addToast({
        title: "Validation",
        message: validationError,
        type: "error",
      });
      return;
    }

    setSendConfirmOpen(true);
  };

  const confirmSendNow = async () => {
    try {
      setSending(true);
      const response = await sendPromoNotification({
        title: sendForm.title.trim(),
        body: sendForm.body.trim(),
        imageUrl: sendForm.imageUrl.trim(),
        itemId: sendForm.itemId,
        categoryId: sendForm.categoryId,
      });
      const count = getSuccessCount(response);

      addToast({
        title: "Notification sent successfully",
        message: count === null ? "Promotion sent." : `Sent to ${count} devices`,
        type: "success",
      });
      setSendConfirmOpen(false);
      setSendForm(createSendForm());
    } catch (error) {
      addToast({
        title: "Send failed",
        message: getErrorMessage(error, "Unable to send notification"),
        type: "error",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSaveSchedule = async (event) => {
    event.preventDefault();

    const validationError = validatePromotion(scheduleForm, { requireTime: true });
    if (validationError) {
      addToast({
        title: "Validation",
        message: validationError,
        type: "error",
      });
      return;
    }

    const duplicate = campaigns.find(
      (campaign) =>
        campaign.campaignType === scheduleForm.campaignType &&
        campaign.scheduledTime.trim().toLowerCase() ===
          scheduleForm.scheduledTime.trim().toLowerCase() &&
        campaign.title.trim().toLowerCase() === scheduleForm.title.trim().toLowerCase()
    );

    if (duplicate) {
      addToast({
        title: "Duplicate campaign",
        message: "A matching campaign already exists.",
        type: "error",
      });
      return;
    }

    try {
      setSavingSchedule(true);
      await savePromoCampaign({
        campaignType: scheduleForm.campaignType,
        title: scheduleForm.title.trim(),
        body: scheduleForm.body.trim(),
        imageUrl: scheduleForm.imageUrl.trim(),
        itemId: scheduleForm.itemId,
        categoryId: scheduleForm.categoryId,
        scheduledTime: scheduleForm.scheduledTime.trim(),
        timezone: TIMEZONE,
        isActive: scheduleForm.isActive,
      });
      addToast({
        title: "Schedule saved",
        message: "Promotion campaign saved successfully",
        type: "success",
      });
      setScheduleForm(createScheduleForm());
      await loadData();
    } catch (error) {
      addToast({
        title: "Save failed",
        message: getErrorMessage(error, "Unable to save campaign"),
        type: "error",
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleCampaign = async (campaign) => {
    if (!campaign?._id || pendingCampaignId) {
      return;
    }

    try {
      setPendingCampaignId(campaign._id);
      await togglePromoCampaign(campaign._id);
      await loadData();
      addToast({
        title: "Campaign updated",
        message: campaign.isActive ? "Campaign marked inactive" : "Campaign marked active",
        type: "success",
      });
    } catch (error) {
      addToast({
        title: "Update failed",
        message: getErrorMessage(error, "Unable to update campaign"),
        type: "error",
      });
    } finally {
      setPendingCampaignId("");
    }
  };

  const confirmDeleteCampaign = async () => {
    if (!deleteTarget?._id) {
      return;
    }

    try {
      setPendingCampaignId(deleteTarget._id);
      await deletePromoCampaign(deleteTarget._id);
      addToast({
        title: "Campaign deleted",
        message: "Scheduled promotion removed successfully",
        type: "success",
      });
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      addToast({
        title: "Delete failed",
        message: getErrorMessage(error, "Unable to delete campaign"),
        type: "error",
      });
    } finally {
      setPendingCampaignId("");
    }
  };

  if (loading) {
    return (
      <div className="page-stack">
        <section className="panel">
          <div className="promotions-skeleton-grid" aria-hidden="true">
            <div className="promotions-skeleton-block" />
            <div className="promotions-skeleton-block" />
            <div className="promotions-skeleton-block" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack promotions-page">
      <section className="panel promotions-hero">
        <div className="promotions-hero-head">
          <div>
            <h2>Promotions</h2>
            <p>Send lunch specials, dinner offers, and new dish alerts to all customers.</p>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setRefreshing(true);
              void loadData();
            }}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {loadError ? (
        <section className="panel error-panel">
          <p className="error-msg">{loadError}</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setLoading(true);
              void loadData();
            }}
          >
            Retry
          </button>
        </section>
      ) : null}

      <section className="panel promotions-section">
        <div className="promotions-section-head">
          <div>
            <h3>Send Now</h3>
            <p>Push a promotion instantly to customers who enabled notifications.</p>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Notification Title
            <input
              value={sendForm.title}
              onChange={(event) =>
                setSendForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Lunch Special"
              maxLength="80"
            />
            <span className="promotions-helper-text">{sendForm.title.length}/80</span>
          </label>

          <label>
            Message
            <textarea
              rows="4"
              value={sendForm.body}
              onChange={(event) =>
                setSendForm((current) => ({ ...current, body: event.target.value }))
              }
              placeholder="Fresh Dum Biryani is ready. Order now!"
              maxLength="180"
            />
            <span className="promotions-helper-text">{sendForm.body.length}/180</span>
          </label>

          <label>
            Image URL optional
            <input
              value={sendForm.imageUrl}
              onChange={(event) =>
                setSendForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
              placeholder="https://..."
            />
          </label>

          <div className="promotions-field-stack">
            <div className="promotions-field-head">
              <span>Select Menu Item optional</span>
              {sendForm.itemId ? (
                <button
                  type="button"
                  className="btn ghost promotions-inline-btn"
                  onClick={() =>
                    setSendForm((current) => ({ ...current, itemId: "", categoryId: "" }))
                  }
                >
                  Clear selected item
                </button>
              ) : null}
            </div>
            <MenuItemSelector
              items={visibleMenuItems}
              selectedItemId={sendForm.itemId}
              onSelect={applyMenuItemToSendForm}
            />
          </div>

          <NotificationPreview
            title={sendForm.title}
            body={sendForm.body}
            imageUrl={sendForm.imageUrl}
          />

          <div className="promotions-actions-row">
            <button type="button" className="btn" onClick={handleSendNowClick} disabled={sending}>
              {sending ? "Sending..." : "Send Now"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel promotions-section">
        <div className="promotions-section-head">
          <div>
            <h3>Daily Schedule</h3>
            <p>Create daily lunch and dinner notification campaigns in {TIMEZONE}.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSaveSchedule}>
          <div className="promotions-field-stack">
            <span>Campaign type</span>
            <div className="promotions-toggle-row">
              {["lunch", "dinner"].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`promotions-type-pill ${
                    scheduleForm.campaignType === type ? "active" : ""
                  }`}
                  onClick={() => handleCampaignTypeChange(type)}
                >
                  {capitalize(type)}
                </button>
              ))}
            </div>
          </div>

          <label>
            Title
            <input
              value={scheduleForm.title}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Dinner Special"
              maxLength="80"
            />
            <span className="promotions-helper-text">{scheduleForm.title.length}/80</span>
          </label>

          <label>
            Message
            <textarea
              rows="4"
              value={scheduleForm.body}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, body: event.target.value }))
              }
              placeholder="Weekend offer is live. Order now!"
              maxLength="180"
            />
            <span className="promotions-helper-text">{scheduleForm.body.length}/180</span>
          </label>

          <label>
            Image URL optional
            <input
              value={scheduleForm.imageUrl}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
              placeholder="https://..."
            />
          </label>

          <div className="promotions-field-stack">
            <div className="promotions-field-head">
              <span>Select Menu Item optional</span>
              {scheduleForm.itemId ? (
                <button
                  type="button"
                  className="btn ghost promotions-inline-btn"
                  onClick={() =>
                    setScheduleForm((current) => ({ ...current, itemId: "", categoryId: "" }))
                  }
                >
                  Clear selected item
                </button>
              ) : null}
            </div>
            <MenuItemSelector
              items={visibleMenuItems}
              selectedItemId={scheduleForm.itemId}
              onSelect={applyMenuItemToScheduleForm}
            />
          </div>

          <div className="promotions-schedule-grid">
            <label>
              Scheduled Time
              <input
                value={scheduleForm.scheduledTime}
                onChange={(event) =>
                  setScheduleForm((current) => ({
                    ...current,
                    scheduledTime: event.target.value,
                  }))
                }
                placeholder={DEFAULT_TIMES[scheduleForm.campaignType]}
              />
            </label>

            <label className="check-row promotions-check-row">
              <input
                type="checkbox"
                checked={scheduleForm.isActive}
                onChange={(event) =>
                  setScheduleForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              Active
            </label>
          </div>

          <span className="promotions-helper-text">
            Defaults: Lunch 12:30 PM, Dinner 7:30 PM, timezone {TIMEZONE}
          </span>

          <NotificationPreview
            title={scheduleForm.title}
            body={scheduleForm.body}
            imageUrl={scheduleForm.imageUrl}
          />

          <div className="promotions-actions-row">
            <button type="submit" className="btn" disabled={savingSchedule}>
              {savingSchedule ? "Saving..." : "Save Schedule"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel promotions-section">
        <div className="promotions-section-head">
          <div>
            <h3>Existing Campaigns</h3>
            <p>Manage daily lunch and dinner campaigns without creating duplicates.</p>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="promotions-empty-state">
            <p className="muted">No scheduled campaigns yet.</p>
          </div>
        ) : (
          <div className="promotions-campaign-list">
            {campaigns.map((campaign) => (
              <article key={campaign._id} className="promotions-campaign-card">
                <div className="promotions-campaign-top">
                  <div>
                    <h4>{campaign.title}</h4>
                    <p>
                      {capitalize(campaign.campaignType)} - {campaign.scheduledTime || "No time"}
                    </p>
                    <p>{campaign.body || "No message"}</p>
                    {campaign.lastSentAt ? (
                      <span className="promotions-campaign-last-sent">
                        Last sent {formatDateTime(campaign.lastSentAt)}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`promotions-status-badge ${
                      campaign.isActive ? "active" : "inactive"
                    }`}
                  >
                    {campaign.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="promotions-campaign-actions">
                  <button
                    type="button"
                    className={`btn ${campaign.isActive ? "ghost" : "success"}`}
                    onClick={() => void handleToggleCampaign(campaign)}
                    disabled={pendingCampaignId === campaign._id}
                  >
                    {campaign.isActive ? "Make Inactive" : "Make Active"}
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setDeleteTarget(campaign)}
                    disabled={pendingCampaignId === campaign._id}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={sendConfirmOpen}
        title="Send notification?"
        description="This notification will be sent to all customers with notifications enabled."
        confirmText="Send Now"
        loading={sending}
        onCancel={() => setSendConfirmOpen(false)}
        onConfirm={() => void confirmSendNow()}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete campaign?"
        description="This scheduled promotion will be removed."
        confirmText="Delete"
        loading={pendingCampaignId === deleteTarget?._id}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteCampaign()}
      />
    </div>
  );
}
