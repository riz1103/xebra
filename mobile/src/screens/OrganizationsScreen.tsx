import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { Organization } from "../types";

export function OrganizationsScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getOrganizations();
      setItems(res.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("orgs.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  return (
    <StaffBody>
      <Field label={t("bundles.name")} value={name} onChangeText={setName} />
      <Field label={t("bundles.description")} value={description} onChangeText={setDescription} />
      <Primary
        label={t("orgs.new")}
        onPress={() => {
          api
            .createOrganization({ name: name.trim(), description: description.trim() })
            .then(() => {
              setName("");
              setDescription("");
              return load();
            })
            .catch((err) => setError(apiErrorMessage(err, t("orgs.loadError"))));
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items.length === 0 ? <Text style={styles.muted}>{t("orgs.none")}</Text> : null}
      {items.map((org) => (
        <View key={org.id} style={styles.card}>
          <Text style={styles.title}>{org.name}</Text>
          <Text style={styles.muted}>{org.description}</Text>
          <Text style={styles.muted}>
            {t("orgs.members")}: {org.memberCount}
          </Text>
          <Ghost label={t("orgs.members")} onPress={() => navigation.navigate("OrgDetail", { orgId: org.id })} />
        </View>
      ))}
    </StaffBody>
  );
}
