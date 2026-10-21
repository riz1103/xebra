import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import { Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { ExamineeGroup } from "../types";

export function GroupsScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const [items, setItems] = useState<ExamineeGroup[]>([]);
  const [open, setOpen] = useState<ExamineeGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getExamineeGroups();
      setItems(res.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("groups.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  async function openGroup(id: string) {
    const res = await api.getExamineeGroup(id);
    setOpen(res.data);
  }

  return (
    <StaffBody>
      <Field label={t("bundles.name")} value={name} onChangeText={setName} />
      <Field label={t("bundles.description")} value={description} onChangeText={setDescription} />
      <Primary
        label={t("groups.new")}
        onPress={() => {
          api
            .createExamineeGroup({ name: name.trim(), description: description.trim() })
            .then(() => {
              setName("");
              setDescription("");
              return load();
            })
            .catch((err) => setError(apiErrorMessage(err, t("groups.loadError"))));
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items.length === 0 ? <Text style={styles.muted}>{t("groups.none")}</Text> : null}
      {items.map((group) => (
        <View key={group.id} style={styles.card}>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.muted}>{group.description}</Text>
          <Text style={styles.muted}>
            {t("groups.code")}: {group.joinCode || "—"}
          </Text>
          <View style={styles.row}>
            <Ghost label={t("groups.members")} onPress={() => openGroup(group.id).catch((err) => setError(apiErrorMessage(err, t("groups.loadError"))))} />
            <Ghost
              label={t("groups.newCode")}
              onPress={() => {
                api
                  .regenerateGroupJoinCode(group.id)
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("groups.loadError"))));
              }}
            />
            <Ghost
              label={t("groups.disable")}
              onPress={() => {
                api
                  .disableGroupJoinCode(group.id)
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("groups.loadError"))));
              }}
            />
            <Ghost
              label={t("common.delete")}
              danger
              onPress={() => {
                api
                  .deleteExamineeGroup(group.id)
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("groups.loadError"))));
              }}
            />
          </View>
          {open?.id === group.id ? (
            <View style={{ gap: 8 }}>
              {(open.members || []).map((member) => (
                <View key={member.uid || member.id || member.email} style={styles.row}>
                  <Text style={styles.body}>{member.name || member.email}</Text>
                  <Ghost
                    label={t("groups.remove")}
                    danger
                    onPress={() => {
                      const memberId = member.uid || member.id;
                      if (!memberId) return;
                      api
                        .removeGroupMembers(group.id, [memberId])
                        .then(() => openGroup(group.id))
                        .catch((err) => setError(apiErrorMessage(err, t("groups.loadError"))));
                    }}
                  />
                </View>
              ))}
              <Field label={t("invites.email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Ghost
                label={t("groups.add")}
                onPress={() => {
                  api
                    .addGroupMembers(group.id, [email.trim()])
                    .then(() => {
                      setEmail("");
                      return openGroup(group.id);
                    })
                    .catch((err) => setError(apiErrorMessage(err, t("groups.loadError"))));
                }}
              />
            </View>
          ) : null}
        </View>
      ))}
    </StaffBody>
  );
}
