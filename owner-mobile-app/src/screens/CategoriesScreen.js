import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { launchImageLibrary } from "react-native-image-picker";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import CategoryCard from "../components/CategoryCard";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
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

const createInitialForm = () => ({
  name: "",
  imageUrl: "",
  imageAsset: null,
});

const normalizeCategory = (category) => ({
  ...category,
  _id: category?._id || category?.id || "",
  name: category?.name || "Unnamed Category",
  imageUrl: category?.imageUrl || category?.image || "",
  itemCount:
    category?.itemCount ??
    category?.itemsCount ??
    category?.totalItems ??
    category?.menuItemsCount ??
    category?.menuItemCount ??
    null,
});

export default function CategoriesScreen() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(createInitialForm());
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetchCategories();
      setCategories((response || []).map(normalizeCategory));
    } catch (error) {
      Alert.alert("Categories", error?.message || "Failed to load categories");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadCategories();
    }, [loadCategories])
  );

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setForm(createInitialForm());
    setModalVisible(true);
  };

  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    setForm({
      name: category?.name || "",
      imageUrl: category?.imageUrl || "",
      imageAsset: null,
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

    if (!trimmedName) {
      Alert.alert("Validation", "Please enter category name");
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
        imageUrl,
      };

      if (editingCategory?._id) {
        await updateCategory(editingCategory._id, payload);
      } else {
        await createCategory(payload);
      }

      setModalVisible(false);
      setForm(createInitialForm());
      await loadCategories();
    } catch (error) {
      Alert.alert("Save failed", error?.message || "Unable to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (category) => {
    Alert.alert(
      "Delete Category",
      "Are you sure you want to remove this category from the menu?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategory(category._id);
              await loadCategories();
            } catch (error) {
              Alert.alert("Delete failed", error?.message || "Unable to delete category");
            }
          },
        },
      ]
    );
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
              void loadCategories();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.title}>Categories</Text>
            <Text style={styles.subtitle}>Group menu items into clean food sections.</Text>
          </View>
          <AppButton
            label="Add"
            leftIcon="add-outline"
            onPress={handleOpenCreate}
            fullWidth={false}
          />
        </View>

        <View style={styles.list}>
          {categories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No categories found.</Text>
            </View>
          ) : (
            categories.map((category) => (
              <CategoryCard
                key={category._id}
                category={category}
                onEdit={() => handleOpenEdit(category)}
                onDelete={() => handleDelete(category)}
              />
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
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCategory ? "Edit Category" : "Add Category"}
            </Text>
            <View style={styles.modalBody}>
              <AppInput
                label="Category Name"
                value={form.name}
                onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                placeholder="e.g. Biryani"
              />

              <AppButton
                label={form.imageAsset || form.imageUrl ? "Change Image" : "Upload Image"}
                leftIcon="image-outline"
                variant="secondary"
                onPress={handlePickImage}
              />

              {form.imageAsset ? (
                <Text style={styles.previewText}>
                  Selected: {form.imageAsset.fileName || "category-image"}
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
          </View>
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
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: layout.screenPadding,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadowStrong,
  },
  modalTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: "800",
  },
  modalBody: {
    gap: spacing.md,
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
