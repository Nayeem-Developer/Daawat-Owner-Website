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
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import MenuItemCard from "../components/MenuItemCard";
import {
  createMenuItem,
  deleteMenuItem,
  fetchCategories,
  fetchMenuItems,
  updateMenuItem,
  uploadImage,
} from "../api/ownerApi";
import {
  colors,
  layout,
  radius,
  shadowStrong,
  spacing,
  typography,
} from "../theme/theme";

const createInitialForm = (categoryId = "") => ({
  name: "",
  categoryId,
  price: "",
  description: "",
  imageUrl: "",
  imageAsset: null,
  isVeg: true,
  isAvailable: true,
});

const normalizeCategory = (category) => ({
  _id: category?._id || category?.id || "",
  name: category?.name || "",
});

const normalizeItem = (item) => ({
  ...item,
  _id: item?._id || item?.id || "",
  categoryId: item?.categoryId?._id || item?.category?._id || item?.categoryId || "",
  categoryName:
    item?.categoryId?.name || item?.category?.name || item?.categoryName || "Uncategorized",
  imageUrl: item?.imageUrl || item?.image || "",
  isVeg: item?.isVeg === true,
  isAvailable: item?.isAvailable !== false,
  price: Number(item?.price || 0),
});

export default function MenuItemsScreen() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(createInitialForm());
  const [saving, setSaving] = useState(false);
  const [pendingItemId, setPendingItemId] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [categoriesResponse, itemsResponse] = await Promise.all([
        fetchCategories(),
        fetchMenuItems(),
      ]);

      setCategories((categoriesResponse || []).map(normalizeCategory));
      setItems((itemsResponse || []).map(normalizeItem));
    } catch (error) {
      Alert.alert("Menu Items", error?.message || "Failed to load menu items");
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

  const groupedItems = useMemo(() => {
    const lookup = new Map(categories.map((category) => [category._id, category.name]));
    const filtered = items.filter((item) => {
      const searchable = [
        item.name,
        item.categoryName,
        String(item.price),
        item.isVeg ? "veg" : "non veg",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(search.trim().toLowerCase());
    });

    return categories.map((category) => ({
      ...category,
      items: filtered
        .filter((item) => item.categoryId === category._id || item.categoryName === category.name)
        .map((item) => ({
          ...item,
          categoryName: lookup.get(item.categoryId) || item.categoryName,
        })),
    }));
  }, [categories, items, search]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm(createInitialForm(categories[0]?._id || ""));
    setModalVisible(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      categoryId: item.categoryId || "",
      price: String(item.price ?? ""),
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      imageAsset: null,
      isVeg: item.isVeg === true,
      isAvailable: item.isAvailable !== false,
    });
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
    const trimmedName = form.name.trim();
    const price = Number(form.price);

    if (!trimmedName) {
      Alert.alert("Validation", "Please enter item name");
      return;
    }

    if (!form.categoryId) {
      Alert.alert("Validation", "Please select a category");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      Alert.alert("Validation", "Please enter a valid price");
      return;
    }

    try {
      setSaving(true);
      let imageUrl = form.imageUrl || "";

      if (form.imageAsset) {
        imageUrl = await uploadImage(form.imageAsset);
      }

      const payload = {
        name: trimmedName,
        categoryId: form.categoryId,
        price,
        imageUrl,
        description: form.description.trim(),
        isVeg: Boolean(form.isVeg),
        isAvailable: Boolean(form.isAvailable),
        isActive: true,
      };

      if (editingItem?._id) {
        await updateMenuItem(editingItem._id, payload);
      } else {
        await createMenuItem(payload);
      }

      setModalVisible(false);
      setForm(createInitialForm());
      await loadData();
    } catch (error) {
      Alert.alert("Save failed", error?.message || "Unable to save menu item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert("Delete Menu Item", "Remove this item from the menu?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMenuItem(item._id);
            await loadData();
          } catch (error) {
            Alert.alert("Delete failed", error?.message || "Unable to delete menu item");
          }
        },
      },
    ]);
  };

  const handleToggleAvailability = async (item) => {
    try {
      setPendingItemId(item._id);
      await updateMenuItem(item._id, { isAvailable: !item.isAvailable });
      await loadData();
    } catch (error) {
      Alert.alert("Update failed", error?.message || "Unable to update item availability");
    } finally {
      setPendingItemId("");
    }
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
            <Text style={styles.title}>Menu Items</Text>
            <Text style={styles.subtitle}>
              Edit pricing, visibility, and product details category-wise.
            </Text>
          </View>
          <AppButton
            label="Add"
            leftIcon="plus"
            onPress={handleOpenCreate}
            fullWidth={false}
          />
        </View>

        <AppInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search menu items..."
        />

        {groupedItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No categories available.</Text>
          </View>
        ) : (
          groupedItems.map((category) => (
            <View key={category._id} style={styles.section}>
              <Text style={styles.sectionTitle}>{category.name}</Text>
              {category.items.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No items in this category.</Text>
                </View>
              ) : (
                <View style={styles.cards}>
                  {category.items.map((item) => (
                    <MenuItemCard
                      key={item._id}
                      item={item}
                      onEdit={() => handleOpenEdit(item)}
                      onDelete={() => handleDelete(item)}
                      onToggleAvailability={() => handleToggleAvailability(item)}
                      pending={pendingItemId === item._id}
                    />
                  ))}
                </View>
              )}
            </View>
          ))
        )}
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
                {editingItem ? "Edit Menu Item" : "Add Menu Item"}
              </Text>
              <AppInput
                label="Item Name"
                value={form.name}
                onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder="e.g. Chicken Biryani"
              />
              <AppInput
                label="Price"
                value={form.price}
                onChangeText={(value) => setForm((current) => ({ ...current, price: value }))}
                placeholder="120"
                keyboardType="numeric"
              />
              <AppInput
                label="Description"
                value={form.description}
                onChangeText={(value) =>
                  setForm((current) => ({ ...current, description: value }))
                }
                placeholder="Optional item note"
                multiline
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.choiceWrap}>
                {categories.map((category) => (
                  <AppButton
                    key={category._id}
                    label={category.name}
                    variant={form.categoryId === category._id ? "primary" : "chip"}
                    size="sm"
                    onPress={() => setForm((current) => ({ ...current, categoryId: category._id }))}
                    fullWidth={false}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.choiceWrap}>
                <AppButton
                  label="Veg"
                  variant={form.isVeg ? "success" : "chip"}
                  size="sm"
                  onPress={() => setForm((current) => ({ ...current, isVeg: true }))}
                  fullWidth={false}
                />
                <AppButton
                  label="Non-Veg"
                  variant={!form.isVeg ? "warning" : "chip"}
                  size="sm"
                  onPress={() => setForm((current) => ({ ...current, isVeg: false }))}
                  fullWidth={false}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Available</Text>
                <Switch
                  value={form.isAvailable}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, isAvailable: value }))
                  }
                  thumbColor={colors.white}
                  trackColor={{ false: "#d1c4b8", true: colors.success }}
                />
              </View>

              <AppButton
                label={form.imageAsset || form.imageUrl ? "Change Image" : "Upload Image"}
                variant="secondary"
                leftIcon="image-outline"
                onPress={handlePickImage}
              />
              {form.imageAsset ? (
                <Text style={styles.previewText}>
                  Selected: {form.imageAsset.fileName || "item-image"}
                </Text>
              ) : form.imageUrl ? (
                <Text style={styles.previewText}>Current image available</Text>
              ) : null}

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
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
  },
  cards: {
    gap: spacing.md,
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
  fieldLabel: {
    color: colors.textSoft,
    fontSize: typography.small,
    fontWeight: "600",
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewText: {
    color: colors.muted,
    fontSize: typography.small,
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
