import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { launchImageLibrary } from "react-native-image-picker";
import AppIcon from "../components/AppIcon";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  fetchMenuItems,
  updateBanner,
  uploadImage,
} from "../api/ownerApi";
import {
  colors,
  layout,
  radius,
  shadow,
  shadowStrong,
  spacing,
  typography,
} from "../theme/theme";
import { formatCurrency } from "../utils/formatters";

const createInitialForm = () => ({
  title: "",
  description: "",
  imageUrl: "",
  imageAsset: null,
  menuItemId: "",
  buttonText: "Order Now",
  displayOrder: "0",
  isActive: true,
});

const normalizeBanner = (banner) => ({
  ...banner,
  _id: banner?._id || banner?.id || "",
  title: banner?.title || banner?.name || "",
  description: banner?.description || "",
  imageUrl: banner?.imageUrl || banner?.image || "",
  menuItemId: banner?.menuItemId?._id || banner?.menuItem?._id || banner?.menuItemId || "",
  linkedMenuItemName:
    banner?.menuItemId?.name || banner?.menuItem?.name || banner?.menuItemName || "No item linked",
  buttonText: banner?.buttonText || "Order Now",
  displayOrder: String(Number(banner?.displayOrder || 0)),
  isActive: banner?.isActive !== false,
});

const normalizeItem = (item) => ({
  _id: item?._id || item?.id || "",
  name: item?.name || "",
  categoryName: item?.categoryId?.name || item?.category?.name || item?.categoryName || "Category",
  price: Number(item?.price || 0),
});

export default function BannersScreen() {
  const [banners, setBanners] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [form, setForm] = useState(createInitialForm());
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [bannersResponse, menuItemsResponse] = await Promise.all([
        fetchBanners(),
        fetchMenuItems(),
      ]);

      setBanners((bannersResponse || []).map(normalizeBanner));
      setMenuItems((menuItemsResponse || []).map(normalizeItem));
    } catch (error) {
      Alert.alert("Banners", error?.message || "Failed to load banners");
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

  const filteredMenuItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return menuItems;
    }

    return menuItems.filter((item) =>
      [item.name, item.categoryName, String(item.price)]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [menuItems, search]);

  const handleOpenCreate = () => {
    setEditingBanner(null);
    setForm(createInitialForm());
    setSearch("");
    setModalVisible(true);
  };

  const handleOpenEdit = (banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title || "",
      description: banner.description || "",
      imageUrl: banner.imageUrl || "",
      imageAsset: null,
      menuItemId: banner.menuItemId || "",
      buttonText: banner.buttonText || "Order Now",
      displayOrder: String(banner.displayOrder || 0),
      isActive: banner.isActive !== false,
    });
    setSearch("");
    setModalVisible(true);
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.85,
    });

    if (!result.didCancel && result.assets?.[0]) {
      setForm((current) => ({ ...current, imageAsset: result.assets[0] }));
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert("Validation", "Please enter banner title");
      return;
    }

    if (!form.menuItemId) {
      Alert.alert("Validation", "Please select a linked menu item");
      return;
    }

    try {
      setSaving(true);
      let imageUrl = form.imageUrl || "";

      if (form.imageAsset) {
        imageUrl = await uploadImage(form.imageAsset);
      }

      if (!imageUrl) {
        Alert.alert("Validation", "Please upload banner image");
        return;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl,
        menuItemId: form.menuItemId,
        buttonText: form.buttonText.trim() || "Order Now",
        displayOrder: Number(form.displayOrder) || 0,
        isActive: Boolean(form.isActive),
      };

      if (editingBanner?._id) {
        await updateBanner(editingBanner._id, payload);
      } else {
        await createBanner(payload);
      }

      setModalVisible(false);
      setForm(createInitialForm());
      await loadData();
    } catch (error) {
      Alert.alert("Save failed", error?.message || "Unable to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (banner) => {
    Alert.alert("Delete Banner", "Remove this banner from the customer app home page?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBanner(banner._id);
            await loadData();
          } catch (error) {
            Alert.alert("Delete failed", error?.message || "Unable to delete banner");
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
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
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
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.title}>Banners</Text>
            <Text style={styles.subtitle}>Control promotions shown in the customer app.</Text>
          </View>
          <AppButton
            label="Add"
            leftIcon="plus"
            onPress={handleOpenCreate}
            fullWidth={false}
          />
        </View>

        <View style={styles.list}>
          {banners.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No banners found.</Text>
            </View>
          ) : (
            banners.map((banner) => (
              <View key={banner._id} style={styles.bannerCard}>
                <View style={styles.bannerHeader}>
                  <View style={styles.bannerIconWrap}>
                    <AppIcon name="bullhorn-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={styles.bannerTitle}>{banner.title || "Untitled banner"}</Text>
                    <Text style={styles.bannerMeta}>
                      Linked item: {banner.linkedMenuItemName}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.bannerPill,
                      banner.isActive ? styles.activePill : styles.inactivePill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bannerPillText,
                        { color: banner.isActive ? colors.success : colors.danger },
                      ]}
                    >
                      {banner.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.bannerDescription}>
                  {banner.description || "No description provided"}
                </Text>
                <Text style={styles.bannerMeta}>Display order: {banner.displayOrder}</Text>

                <View style={styles.bannerActions}>
                  <AppButton
                    label="Edit"
                    variant="secondary"
                    size="sm"
                    leftIcon="pencil-outline"
                    onPress={() => handleOpenEdit(banner)}
                    fullWidth={false}
                  />
                  <AppButton
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    leftIcon="trash-can-outline"
                    onPress={() => handleDelete(banner)}
                    fullWidth={false}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingBanner ? "Edit Banner" : "Add Banner"}
              </Text>
              <AppInput
                label="Banner Title"
                value={form.title}
                onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
                placeholder="Fresh Deals This Week"
              />
              <AppInput
                label="Description"
                value={form.description}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, description: value }))
                }
                placeholder="Hot and delicious menu picks for today"
                multiline
              />
              <AppButton
                label={form.imageAsset || form.imageUrl ? "Change Image" : "Upload Image"}
                variant="secondary"
                leftIcon="image-outline"
                onPress={handlePickImage}
              />
              {form.imageAsset ? (
                <Text style={styles.previewText}>
                  Selected: {form.imageAsset.fileName || "banner-image"}
                </Text>
              ) : form.imageUrl ? (
                <Text style={styles.previewText}>Current image available</Text>
              ) : null}

              <AppInput
                label="Search Linked Menu Item"
                value={search}
                onChangeText={setSearch}
                placeholder="Search menu item..."
              />

              <View style={styles.menuItemList}>
                {filteredMenuItems.map((item) => (
                  <AppButton
                    key={item._id}
                    label={`${item.name} | ${formatCurrency(item.price)}`}
                    variant={form.menuItemId === item._id ? "primary" : "chip"}
                    size="sm"
                    onPress={() => setForm((current) => ({ ...current, menuItemId: item._id }))}
                    fullWidth={false}
                  />
                ))}
              </View>

              <AppInput
                label="Button Text"
                value={form.buttonText}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, buttonText: value }))
                }
                placeholder="Order Now"
              />
              <AppInput
                label="Display Order"
                value={form.displayOrder}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, displayOrder: value }))
                }
                placeholder="0"
                keyboardType="numeric"
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Active Banner</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={(value) => setForm((current) => ({ ...current, isActive: value }))}
                  thumbColor={colors.white}
                  trackColor={{ false: "#d1c4b8", true: colors.success }}
                />
              </View>

              <View style={styles.modalActions}>
                <AppButton
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setModalVisible(false)}
                  fullWidth={false}
                  style={styles.modalAction}
                />
                <AppButton
                  label={saving ? "Saving..." : "Save"}
                  onPress={handleSave}
                  loading={saving}
                  fullWidth={false}
                  style={styles.modalAction}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
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
    padding: layout.screenPadding,
    paddingBottom: layout.bottomInset + spacing.xxl,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
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
  list: {
    gap: spacing.md,
  },
  bannerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  bannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: "700",
  },
  bannerMeta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  bannerDescription: {
    color: colors.textSoft,
    fontSize: typography.small,
    lineHeight: 19,
  },
  bannerPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activePill: {
    backgroundColor: colors.successSoft,
    borderColor: "#bfe5ce",
  },
  inactivePill: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#f3c2bc",
  },
  bannerPillText: {
    fontSize: typography.tiny,
    fontWeight: "700",
  },
  bannerActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: layout.screenPadding,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadowStrong,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
  },
  previewText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  menuItemList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalAction: {
    flex: 1,
  },
});
