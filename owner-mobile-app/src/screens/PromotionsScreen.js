import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import {
  fetchMenuItems,
} from "../api/ownerApi";
import {
  deletePromoCampaign,
  getPromoCampaigns,
  savePromoCampaign,
  sendPromoNotification,
  togglePromoCampaign,
} from "../api/promoApi";
import useResponsiveScreen from "../hooks/useResponsiveScreen";
import {
  colors,
  radius,
  shadow,
  spacing,
  typography,
} from "../theme/theme";

const DEFAULT_TIMES = {
  lunch: "12:30 PM",
  dinner: "7:30 PM",
  custom: "9:00 AM",
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

const normalizeItem = (item) => ({
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
    campaignType: String(campaignType || "").toLowerCase(),
    scheduledTime,
    isActive: campaign?.isActive ?? campaign?.active ?? false,
    lastSentAt: campaign?.lastSentAt || campaign?.lastSent || campaign?.sentAt || "",
  };
};

const filterMenuItems = (items, searchTerm) => {
  const query = String(searchTerm || "").trim().toLowerCase();

  if (!query) {
    return items;
  }

  return items.filter((item) => {
    const searchable = [item.name, item.categoryName].filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(query);
  });
};

const capitalize = (value) => {
  const text = String(value || "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Daily";
};

const formatCampaignTypeLabel = (value) => {
  switch (String(value || "").trim().toLowerCase()) {
    case "lunch":
    case "daily_lunch":
      return "Lunch";
    case "dinner":
    case "daily_dinner":
      return "Dinner";
    case "custom":
    case "custom_daily":
      return "Custom";
    default:
      return capitalize(value);
  }
};

const mapScheduleType = (campaignType) => {
  switch (String(campaignType || "").trim().toLowerCase()) {
    case "lunch":
    case "daily_lunch":
      return "daily_lunch";
    case "dinner":
    case "daily_dinner":
      return "daily_dinner";
    case "custom":
    case "custom_daily":
      return "custom_daily";
    default:
      return "";
  }
};

const formatScheduledTimeValue = (value) => {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const already24Hour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (already24Hour) {
    return text;
  }

  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text);
  if (!twelveHour) {
    return "";
  }

  let hour = Number(twelveHour[1]);
  const minute = twelveHour[2];
  const meridiem = twelveHour[3].toUpperCase();

  if (Number.isNaN(hour) || hour < 1 || hour > 12) {
    return "";
  }

  if (meridiem === "AM") {
    hour = hour === 12 ? 0 : hour;
  } else {
    hour = hour === 12 ? 12 : hour + 12;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

const validatePromotion = (form, { requireTime = false } = {}) => {
  const title = form.title.trim();
  const body = form.body.trim();
  const imageUrl = form.imageUrl.trim();

  if (!title) {
    return "Notification title is required";
  }

  if (title.length > 80) {
    return "Title must be 80 characters or less";
  }

  if (!body) {
    return "Message is required";
  }

  if (body.length > 180) {
    return "Message must be 180 characters or less";
  }

  if (imageUrl && !imageUrl.startsWith("https://")) {
    return "Image URL must start with https://";
  }

  if (requireTime && !form.scheduledTime.trim()) {
    return "Schedule time is required";
  }

  if (requireTime && !formatScheduledTimeValue(form.scheduledTime)) {
    return "Schedule time must be in HH:mm or AM/PM format";
  }

  return "";
};

function NotificationPreview({ title, body, imageUrl }) {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewContent}>
        <Text style={styles.previewTitle}>{title || "Lunch Special"}</Text>
        <Text style={styles.previewBody}>
          {body || "Fresh Dum Biryani is ready. Order now!"}
        </Text>
      </View>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.previewImage} /> : null}
    </View>
  );
}

function MenuItemSelector({ items, selectedItemId, onSelect, emptyText }) {
  if (items.length === 0) {
    return <Text style={styles.helperText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.selectorWrap}>
      {items.map((item) => (
        <Pressable
          key={item._id}
          onPress={() => onSelect(item)}
          style={({ pressed }) => [
            styles.menuChip,
            selectedItemId === item._id && styles.menuChipSelected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.menuChipTitle,
              selectedItemId === item._id && styles.menuChipTitleSelected,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.menuChipMeta} numberOfLines={1}>
            {item.categoryName}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function PromotionsScreen() {
  const {
    bottomPadding,
    horizontalPadding,
    maxContentWidth,
    stackHeaderActions,
    topPadding,
  } = useResponsiveScreen();

  const [menuItems, setMenuItems] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [sendForm, setSendForm] = useState(createSendForm());
  const [scheduleForm, setScheduleForm] = useState(createScheduleForm());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState("");
  const [sendItemSearch, setSendItemSearch] = useState("");
  const [scheduleItemSearch, setScheduleItemSearch] = useState("");

  const visibleMenuItems = useMemo(
    () =>
      menuItems
        .map(normalizeItem)
        .filter((item) => item._id && item.name && item.isActive && item.isAvailable),
    [menuItems]
  );

  const filteredSendMenuItems = useMemo(
    () => filterMenuItems(visibleMenuItems, sendItemSearch),
    [sendItemSearch, visibleMenuItems]
  );

  const filteredScheduleMenuItems = useMemo(
    () => filterMenuItems(visibleMenuItems, scheduleItemSearch),
    [scheduleItemSearch, visibleMenuItems]
  );

  const loadData = useCallback(async () => {
    try {
      const [itemsResult, campaignsResult] = await Promise.allSettled([
        fetchMenuItems(),
        getPromoCampaigns(),
      ]);

      if (itemsResult.status === "fulfilled") {
        setMenuItems(itemsResult.value || []);
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
        Alert.alert("Promotions", firstError?.message || "Unable to load promotions");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
    }, [loadData])
  );

  const applyMenuItemToSendForm = (item) => {
    setSendItemSearch("");
    setSendForm((current) => ({
      ...current,
      itemId: item._id,
      categoryId: item.categoryId,
      title: current.title.trim() ? current.title : `Try ${item.name} today`,
      imageUrl: current.imageUrl.trim() ? current.imageUrl : item.imageUrl,
    }));
  };

  const applyMenuItemToScheduleForm = (item) => {
    setScheduleItemSearch("");
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
      scheduledTime: DEFAULT_TIMES[campaignType] || current.scheduledTime,
    }));
  };

  const handleSendNow = () => {
    const validationError = validatePromotion(sendForm);
    if (validationError) {
      Alert.alert("Validation", validationError);
      return;
    }

    Alert.alert(
      "Send notification?",
      "Send this promotion to customers now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Now",
          onPress: async () => {
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
              Alert.alert(
                "Notification sent successfully",
                count === null ? "Promotion sent." : `Sent to ${count} devices`
              );
              setSendForm(createSendForm());
            } catch (error) {
              Alert.alert("Send failed", error?.message || "Unable to send notification");
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveSchedule = async () => {
    const validationError = validatePromotion(scheduleForm, { requireTime: true });
    if (validationError) {
      Alert.alert("Validation", validationError);
      return;
    }

    const scheduleType = mapScheduleType(scheduleForm.campaignType);
    const scheduledTime = formatScheduledTimeValue(scheduleForm.scheduledTime);

    if (!scheduleType || !scheduledTime) {
      Alert.alert(
        "Validation",
        "Could not save schedule. Please check title, message, and time."
      );
      return;
    }

    const duplicate = campaigns.find(
      (campaign) =>
        mapScheduleType(campaign.campaignType) === scheduleType &&
        formatScheduledTimeValue(campaign.scheduledTime) === scheduledTime &&
        campaign.title.trim().toLowerCase() === scheduleForm.title.trim().toLowerCase()
    );

    if (duplicate) {
      Alert.alert("Duplicate campaign", "A matching campaign already exists.");
      return;
    }

    try {
      setSavingSchedule(true);
      const payload = {
        title: scheduleForm.title.trim(),
        body: scheduleForm.body.trim(),
        imageUrl: scheduleForm.imageUrl.trim(),
        itemId: scheduleForm.itemId,
        categoryId: scheduleForm.categoryId,
        scheduleType,
        scheduledTime,
        timezone: TIMEZONE,
        isActive: scheduleForm.isActive,
      };
      console.log("PROMO_SCHEDULE_PAYLOAD", {
        title: payload.title,
        scheduleType: payload.scheduleType,
        scheduledTime: payload.scheduledTime,
        timezone: payload.timezone,
        hasImage: Boolean(payload.imageUrl),
        hasItem: Boolean(payload.itemId),
      });
      await savePromoCampaign(payload);
      Alert.alert("Schedule saved", "Promotion campaign saved successfully");
      setScheduleForm(createScheduleForm());
      await loadData();
    } catch (error) {
      console.log("PROMO_SCHEDULE_ERROR", error?.data || error?.message || error);
      Alert.alert(
        "Save failed",
        "Could not save schedule. Please check title, message, and time."
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleCampaign = async (campaign) => {
    if (!campaign._id || pendingCampaignId) {
      return;
    }

    try {
      setPendingCampaignId(campaign._id);
      await togglePromoCampaign(campaign._id);
      await loadData();
    } catch (error) {
      Alert.alert("Update failed", error?.message || "Unable to update campaign");
    } finally {
      setPendingCampaignId("");
    }
  };

  const handleDeleteCampaign = (campaign) => {
    if (!campaign._id || pendingCampaignId) {
      return;
    }

    Alert.alert("Delete campaign?", "This scheduled promotion will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setPendingCampaignId(campaign._id);
            await deletePromoCampaign(campaign._id);
            await loadData();
          } catch (error) {
            Alert.alert("Delete failed", error?.message || "Unable to delete campaign");
          } finally {
            setPendingCampaignId("");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPadding,
          paddingHorizontal: horizontalPadding,
          paddingBottom: bottomPadding,
          maxWidth: maxContentWidth,
        },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadData();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={[styles.headerRow, stackHeaderActions && styles.headerRowStacked]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Promotions</Text>
          <Text style={styles.subtitle}>Send offers and daily specials to customers.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Send Now</Text>
        <AppInput
          label="Notification Title"
          value={sendForm.title}
          onChangeText={(value) => setSendForm((current) => ({ ...current, title: value }))}
          placeholder="Lunch Special"
          helperText={`${sendForm.title.length}/80`}
        />
        <AppInput
          label="Message"
          value={sendForm.body}
          onChangeText={(value) => setSendForm((current) => ({ ...current, body: value }))}
          placeholder="Fresh Dum Biryani is ready. Order now!"
          multiline
          helperText={`${sendForm.body.length}/180`}
        />
        <AppInput
          label="Image URL optional"
          value={sendForm.imageUrl}
          onChangeText={(value) => setSendForm((current) => ({ ...current, imageUrl: value }))}
          placeholder="https://..."
          keyboardType="url"
        />

        <Text style={styles.fieldLabel}>Select Menu Item optional</Text>
        <AppInput
          value={sendItemSearch}
          onChangeText={setSendItemSearch}
          placeholder="Search menu item..."
          rightIcon={sendItemSearch ? "close-circle-outline" : null}
          onRightIconPress={() => setSendItemSearch("")}
        />
        <MenuItemSelector
          items={filteredSendMenuItems}
          selectedItemId={sendForm.itemId}
          onSelect={applyMenuItemToSendForm}
          emptyText={
            visibleMenuItems.length === 0
              ? "No menu items available."
              : "No items found"
          }
        />
        {sendForm.itemId ? (
          <Text style={styles.selectedItemText}>
            Selected:{" "}
            {visibleMenuItems.find((item) => item._id === sendForm.itemId)?.name || "Menu item"}
          </Text>
        ) : null}
        {sendForm.itemId ? (
          <AppButton
            label="Clear selected item"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() =>
              setSendForm((current) => ({ ...current, itemId: "", categoryId: "" }))
            }
          />
        ) : null}

        <NotificationPreview
          title={sendForm.title}
          body={sendForm.body}
          imageUrl={sendForm.imageUrl}
        />
        <AppButton
          label={sending ? "Sending..." : "Send Now"}
          leftIcon="send"
          loading={sending}
          onPress={handleSendNow}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Schedule</Text>
        <Text style={styles.fieldLabel}>Campaign type</Text>
        <View style={styles.segmentRow}>
          {["lunch", "dinner", "custom"].map((type) => (
            <AppButton
              key={type}
              label={formatCampaignTypeLabel(type)}
              variant={scheduleForm.campaignType === type ? "primary" : "chip"}
              size="sm"
              fullWidth={false}
              onPress={() => handleCampaignTypeChange(type)}
            />
          ))}
        </View>

        <AppInput
          label="Title"
          value={scheduleForm.title}
          onChangeText={(value) =>
            setScheduleForm((current) => ({ ...current, title: value }))
          }
          placeholder="Lunch Special"
          helperText={`${scheduleForm.title.length}/80`}
        />
        <AppInput
          label="Message"
          value={scheduleForm.body}
          onChangeText={(value) =>
            setScheduleForm((current) => ({ ...current, body: value }))
          }
          placeholder="Fresh Dum Biryani is ready. Order now!"
          multiline
          helperText={`${scheduleForm.body.length}/180`}
        />
        <AppInput
          label="Image URL optional"
          value={scheduleForm.imageUrl}
          onChangeText={(value) =>
            setScheduleForm((current) => ({ ...current, imageUrl: value }))
          }
          placeholder="https://..."
          keyboardType="url"
        />

        <Text style={styles.fieldLabel}>Select Menu Item optional</Text>
        <AppInput
          value={scheduleItemSearch}
          onChangeText={setScheduleItemSearch}
          placeholder="Search menu item..."
          rightIcon={scheduleItemSearch ? "close-circle-outline" : null}
          onRightIconPress={() => setScheduleItemSearch("")}
        />
        <MenuItemSelector
          items={filteredScheduleMenuItems}
          selectedItemId={scheduleForm.itemId}
          onSelect={applyMenuItemToScheduleForm}
          emptyText={
            visibleMenuItems.length === 0
              ? "No menu items available."
              : "No items found"
          }
        />
        {scheduleForm.itemId ? (
          <Text style={styles.selectedItemText}>
            Selected:{" "}
            {visibleMenuItems.find((item) => item._id === scheduleForm.itemId)?.name || "Menu item"}
          </Text>
        ) : null}
        {scheduleForm.itemId ? (
          <AppButton
            label="Clear selected item"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() =>
              setScheduleForm((current) => ({ ...current, itemId: "", categoryId: "" }))
            }
          />
        ) : null}

        <AppInput
          label="Scheduled Time"
          value={scheduleForm.scheduledTime}
          onChangeText={(value) =>
            setScheduleForm((current) => ({ ...current, scheduledTime: value }))
          }
          placeholder={DEFAULT_TIMES[scheduleForm.campaignType]}
        />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.fieldLabel}>Active</Text>
            <Text style={styles.helperText}>{TIMEZONE}</Text>
          </View>
          <Switch
            value={scheduleForm.isActive}
            onValueChange={(value) =>
              setScheduleForm((current) => ({ ...current, isActive: value }))
            }
            thumbColor={colors.white}
            trackColor={{ false: "#d1c4b8", true: colors.success }}
          />
        </View>

        <NotificationPreview
          title={scheduleForm.title}
          body={scheduleForm.body}
          imageUrl={scheduleForm.imageUrl}
        />
        <AppButton
          label={savingSchedule ? "Saving..." : "Save Schedule"}
          leftIcon="content-save-outline"
          loading={savingSchedule}
          onPress={handleSaveSchedule}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.campaignHead}>
          <Text style={styles.cardTitle}>Existing Campaigns</Text>
          <AppButton
            label="Refresh"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => void loadData()}
          />
        </View>

        {campaigns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No scheduled campaigns yet.</Text>
          </View>
        ) : (
          <View style={styles.campaignList}>
            {campaigns.map((campaign) => (
              <View key={campaign._id} style={styles.campaignCard}>
                <View style={styles.campaignTopRow}>
                  <View style={styles.campaignTitleWrap}>
                    <Text style={styles.campaignTitle}>{campaign.title}</Text>
                    <Text style={styles.campaignMeta}>
                      {formatCampaignTypeLabel(campaign.campaignType)} - {campaign.scheduledTime || "No time"}
                    </Text>
                    {campaign.lastSentAt ? (
                      <Text style={styles.campaignMeta}>
                        Last sent {formatDateTime(campaign.lastSentAt)}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      campaign.isActive ? styles.statusActive : styles.statusInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: campaign.isActive ? colors.success : colors.danger },
                      ]}
                    >
                      {campaign.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <View style={styles.campaignActions}>
                  <AppButton
                    label={campaign.isActive ? "Make Inactive" : "Make Active"}
                    variant={campaign.isActive ? "ghost" : "success"}
                    size="sm"
                    fullWidth={false}
                    disabled={pendingCampaignId === campaign._id}
                    onPress={() => handleToggleCampaign(campaign)}
                  />
                  <AppButton
                    label="Delete"
                    variant="danger"
                    size="sm"
                    fullWidth={false}
                    disabled={pendingCampaignId === campaign._id}
                    onPress={() => handleDeleteCampaign(campaign)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "100%",
    alignSelf: "center",
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerRowStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
  },
  fieldLabel: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "700",
  },
  helperText: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "600",
  },
  selectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  menuChip: {
    maxWidth: "100%",
    minWidth: 126,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  menuChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  menuChipTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  menuChipTitleSelected: {
    color: colors.primary,
  },
  menuChipMeta: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.92,
  },
  previewCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.sm,
  },
  previewContent: {
    gap: spacing.xs,
  },
  previewTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "800",
  },
  previewBody: {
    color: colors.textSoft,
    fontSize: typography.small,
    lineHeight: 19,
  },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: spacing.xs,
  },
  campaignHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  emptyCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  campaignList: {
    gap: spacing.md,
  },
  campaignCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.md,
  },
  campaignTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  campaignTitleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  campaignTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "800",
  },
  campaignMeta: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: "600",
  },
  selectedItemText: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusActive: {
    backgroundColor: colors.successSoft,
    borderColor: "#bfe5ce",
  },
  statusInactive: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#f3c2bc",
  },
  statusText: {
    fontSize: typography.tiny,
    fontWeight: "800",
  },
  campaignActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
