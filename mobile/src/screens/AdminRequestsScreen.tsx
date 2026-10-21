import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import { Field, Ghost, StaffBody, useStaffStyles } from "../staff-ui";
import type { ProctorRequest } from "../types";

export function AdminRequestsScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const [items, setItems] = useState<ProctorRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getProctorRequests();
      setItems(res.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("requests.loadError")));
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
      {items.length === 0 ? <Text style={styles.muted}>{t("requests.none")}</Text> : null}
      {items.map((request) => (
        <View key={request.id} style={styles.card}>
          <Text style={styles.title}>{request.userName || request.userEmail}</Text>
          <Text style={styles.muted}>{request.status}</Text>
          <Text style={styles.body}>{request.reason}</Text>
          {request.additionalInfo ? <Text style={styles.muted}>{request.additionalInfo}</Text> : null}
          <Field
            label={t("requests.notes")}
            value={notes[request.id] || ""}
            onChangeText={(value) => setNotes((current) => ({ ...current, [request.id]: value }))}
          />
          {request.status === "pending" ? <View style={styles.row}>
            <Ghost
              label={t("requests.approve")}
              onPress={() => {
                api
                  .approveProctorRequest(request.id, notes[request.id])
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("requests.loadError"))));
              }}
            />
            <Ghost
              label={t("requests.reject")}
              danger
              onPress={() => {
                api
                  .rejectProctorRequest(request.id, notes[request.id])
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("requests.loadError"))));
              }}
            />
          </View> : null}
        </View>
      ))}
    </StaffBody>
  );
}
