import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import { Field, Ghost, StaffBody, useStaffStyles } from "../staff-ui";
import type { QuestionType } from "../types";

const LAYOUTS = [
  ["multiple_choice", "form.mc"],
  ["true_false", "form.tf"],
  ["multiple_answer", "form.ma"],
  ["identification", "form.id"],
  ["essay", "form.essay"],
  ["ordering", "Ordering"],
  ["matching", "Matching"],
  ["audio", "Audio"],
  ["hotspot", "Hotspot"],
] as const;

export function QuestionTypesScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const [items, setItems] = useState<QuestionType[]>([]);
  const [error, setError] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api.getQuestionTypes();
      setItems(res.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("types.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  return (
    <StaffBody>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {LAYOUTS.map(([layout, label]) => {
        const existing = items.find((item) => item.layout === layout);
        const name = label.startsWith("form.") ? t(label as "form.mc") : label;
        return (
          <View key={layout} style={styles.card}>
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.muted}>{existing ? existing.name || layout : layout}</Text>
            {existing ? (
              <View style={{ gap: 8 }}>
                <Field
                  label={t("bundles.name")}
                  value={names[existing.id] ?? existing.name ?? ""}
                  onChangeText={(value) => setNames((current) => ({ ...current, [existing.id]: value }))}
                />
                <View style={styles.row}>
                  <Ghost
                    label={t("common.save")}
                    onPress={() => {
                      api
                        .updateQuestionType(existing.id, { name: names[existing.id] ?? existing.name ?? name })
                        .then(load)
                        .catch((err) => setError(apiErrorMessage(err, t("types.loadError"))));
                    }}
                  />
                  <Ghost
                    label={t("types.delete")}
                    danger
                    onPress={() => {
                      api
                        .deleteQuestionType(existing.id)
                        .then(load)
                        .catch((err) => setError(apiErrorMessage(err, t("types.loadError"))));
                    }}
                  />
                </View>
              </View>
            ) : (
              <Ghost
                label={t("types.create")}
                onPress={() => {
                  api
                    .createQuestionType({ layout, name })
                    .then(load)
                    .catch((err) => setError(apiErrorMessage(err, t("types.loadError"))));
                }}
              />
            )}
          </View>
        );
      })}
      {items.length === 0 ? <Text style={styles.muted}>{t("types.none")}</Text> : null}
    </StaffBody>
  );
}
