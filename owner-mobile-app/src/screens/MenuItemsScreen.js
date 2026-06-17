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
import MenuItemCard from "../components/MenuItemCard";
import {
  createMenuItem,
  deleteMenuItem,
  fetchCategories,
  fetchMenuItems,
  updateMenuItem,
  uploadImage,
} from "../api/ownerApi";
import { colors, radius, shadow, spacing } from "../theme/theme";

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
  categoryName: item?.categoryId?.name || item?.category?.name || item?.categoryName || "Uncategorized",
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

      setCategories(categoriesResponse.map(normalizeCategory));
      setItems(itemsResponse.map(normalizeItem));
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
        item.isVeg ? "veg" : "non-veg",
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

  const handleRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

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
          <Text style={styles.title}>Menu Items</Text>
          <Text style={styles.subtitle}>Manage items category-wise, including price and availability.</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search menu items..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        <AppButton label="+ Add Menu Item" onPress={handleOpenCreate} />

        {groupedItems.length === 0 ? (
          <Text style={styles.emptyText}>No categories available.</Text>
        ) : (
          groupedItems.map((category) => (
            <View key={category._id} style={styles.section}>
              <Text style={styles.sectionTitle}>{category.name}</Text>
              {category.items.length === 0 ? (
                <Text style={styles.emptyText}>No items in this category.</Text>
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

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</Text>
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
                onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
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
                  onPress={() => setForm((current) => ({ ...current, isVeg: true }))}
                  fullWidth={false}
                />
                <AppButton
                  label="Non-Veg"
                  variant={!form.isVeg ? "danger" : "chip"}
                  onPress={() => setForm((current) => ({ ...current, isVeg: false }))}
                  fullWidth={false}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Available</Text>
                <Switch
                  value={form.isAvailable}
                  onValueChange={(value) => setForm((current) => ({ ...current, isAvailable: value }))}
                  thumbColor={colors.white}
                  trackColor={{ false: "#9b3e3e", true: "#37b77b" }}
                />
              </View>

              <AppButton
                label={form.imageAsset || form.imageUrl ? "Change Image" : "Upload Image"}
                variant="ghost"
                onPress={handlePickImage}
              />
              {form.imageAsset ? (
                <Text style={styles.previewText}>Selected: {form.imageAsset.fileName || "item-image"}</Text>
              ) : form.imageUrl ? (
                <Text style={styles.previewText}>Current image available</Text>
              ) : null}

              <View style={styles.modalActions}>
                <AppButton label="Cancel" variant="ghost" onPress={() => setModalVisible(false)} />
                <AppButton label={saving ? "Saving..." : "Save Item"} onPress={handleSave} loading={saving} />
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
  searchInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.text,
    paddingHorizontal: 14,
  },
  section: {
    gap: 12,
    paddingTop: 6,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  cards: {
    gap: 12,
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
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewText: {
    color: colors.muted,
    fontSize: 13,
  },
  modalActions: {
    gap: 10,
    marginTop: 6,
  },
});
