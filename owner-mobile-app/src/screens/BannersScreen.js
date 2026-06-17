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
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
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
import { colors, radius, shadow, spacing } from "../theme/theme";
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
  isVeg: item?.isVeg === true,
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

      setBanners(bannersResponse.map(normalizeBanner));
      setMenuItems(menuItemsResponse.map(normalizeItem));
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
      [item.name, item.categoryName, String(item.price), item.isVeg ? "veg" : "non-veg"]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [menuItems, search]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]) {
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
    Alert.alert("Delete Banner", "Remove this banner from the mobile app home page?", [
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
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Banners</Text>
          <Text style={styles.subtitle}>Manage promotional banners shown in the customer app.</Text>
        </View>

        <AppButton label="+ Add Banner" onPress={handleOpenCreate} />

        <View style={styles.list}>
          {banners.length === 0 ? (
            <Text style={styles.emptyText}>No banners found.</Text>
          ) : (
            banners.map((banner) => (
              <View key={banner._id} style={styles.bannerCard}>
                <View style={{ gap: 6 }}>
                  <Text style={styles.bannerTitle}>{banner.title || "Untitled banner"}</Text>
                  <Text style={styles.bannerMeta}>{banner.description || "No description"}</Text>
                  <Text style={styles.bannerMeta}>Linked item: {banner.linkedMenuItemName}</Text>
                  <Text style={styles.bannerMeta}>Display order: {banner.displayOrder}</Text>
                  <Text style={styles.bannerMeta}>{banner.isActive ? "Active" : "Inactive"}</Text>
                </View>
                <View style={styles.bannerActions}>
                  <AppButton label="Edit" variant="ghost" onPress={() => handleOpenEdit(banner)} />
                  <AppButton label="Delete" variant="danger" onPress={() => handleDelete(banner)} />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editingBanner ? "Edit Banner" : "Add Banner"}</Text>
              <AppInput
                label="Banner Title"
                value={form.title}
                onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
                placeholder="Fresh Deals This Week"
              />
              <AppInput
                label="Description"
                value={form.description}
                onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
                placeholder="Hot and delicious menu picks for today"
                multiline
              />
              <AppButton
                label={form.imageAsset || form.imageUrl ? "Change Image" : "Upload Image"}
                variant="ghost"
                onPress={handlePickImage}
              />
              {form.imageAsset ? (
                <Text style={styles.previewText}>Selected: {form.imageAsset.fileName || "banner-image"}</Text>
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
                    label={`${item.name} • ${formatCurrency(item.price)}`}
                    variant={form.menuItemId === item._id ? "primary" : "chip"}
                    onPress={() => setForm((current) => ({ ...current, menuItemId: item._id }))}
                    fullWidth={false}
                  />
                ))}
              </View>

              <AppInput
                label="Button Text"
                value={form.buttonText}
                onChangeText={(value) => setForm((current) => ({ ...current, buttonText: value }))}
                placeholder="Order Now"
              />
              <AppInput
                label="Display Order"
                value={form.displayOrder}
                onChangeText={(value) => setForm((current) => ({ ...current, displayOrder: value }))}
                placeholder="0"
                keyboardType="numeric"
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Active Banner</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={(value) => setForm((current) => ({ ...current, isActive: value }))}
                  thumbColor={colors.white}
                  trackColor={{ false: "#9b3e3e", true: "#37b77b" }}
                />
              </View>

              <View style={styles.modalActions}>
                <AppButton label="Cancel" variant="ghost" onPress={() => setModalVisible(false)} />
                <AppButton label={saving ? "Saving..." : "Save Banner"} onPress={handleSave} loading={saving} />
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
    padding: spacing.md,
    gap: 14,
  },
  header: {
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  list: {
    gap: 12,
  },
  bannerCard: {
    backgroundColor: "rgba(35,26,26,0.94)",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(213,164,74,0.25)",
    padding: 16,
    gap: 12,
    ...shadow,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  bannerMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  bannerActions: {
    gap: 8,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
    ...shadow,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  previewText: {
    color: colors.muted,
    fontSize: 13,
  },
  menuItemList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  modalActions: {
    gap: 10,
  },
});
