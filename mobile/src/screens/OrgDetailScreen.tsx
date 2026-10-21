import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import type { RootStackParamList } from "../navigation";
import { Choice, Field, Ghost, StaffBody, useStaffStyles } from "../staff-ui";
import type { Exam, Organization } from "../types";

const DEPARTMENTS = ["general", "math", "science", "english", "ict", "other"] as const;

type Props = NativeStackScreenProps<RootStackParamList, "OrgDetail">;

export function OrgDetailScreen({ route }: Props) {
  const t = useT();
  const { styles } = useStaffStyles();
  const [org, setOrg] = useState<Organization | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [department, setDepartment] = useState("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [orgRes, examRes] = await Promise.all([
        api.getOrganization(route.params.orgId),
        api.getExams({ page: 1, size: 100 }),
      ]);
      setOrg(orgRes.data);
      setName(orgRes.data?.name || "");
      setDescription(orgRes.data?.description || "");
      setExams(examRes.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("orgs.loadError")));
    }
  }, [route.params.orgId, t]);

  useState(() => {
    load().catch(() => undefined);
  });

  return (
    <StaffBody>
      <Text style={styles.title}>{org?.name}</Text>
      {org?.canManage ? (
        <View style={styles.card}>
          <Field label={t("bundles.name")} value={name} onChangeText={setName} />
          <Field label={t("bundles.description")} value={description} onChangeText={setDescription} />
          <Ghost
            label={t("orgs.rename")}
            onPress={() => {
              api
                .updateOrganization(route.params.orgId, { name: name.trim(), description: description.trim() || null })
                .then(() => {
                  setNotice(t("orgs.saved"));
                  return load();
                })
                .catch((err) => setError(apiErrorMessage(err, t("orgs.loadError"))));
            }}
          />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      {(org?.members || []).map((member) => (
        <View key={member.uid} style={styles.card}>
          <Text style={styles.body}>{member.name || member.email}</Text>
          <Text style={styles.muted}>
            {member.role} · {member.department || "general"}
          </Text>
          {org?.canManage && member.role !== "owner" ? (
            <View style={styles.row}>
              {DEPARTMENTS.map((id) => (
                <Choice
                  key={id}
                  label={t(`orgs.dept.${id}` as "orgs.dept.general")}
                  on={member.department === id}
                  onPress={() => {
                    api
                      .updateOrganizationMember(route.params.orgId, member.uid, { department: id })
                      .then(load)
                      .catch((err) => setError(apiErrorMessage(err, t("orgs.loadError"))));
                  }}
                />
              ))}
            </View>
          ) : null}
          {org?.canManage && member.role !== "owner" ? (
            <Ghost
              label={t("groups.remove")}
              danger
              onPress={() => {
                api
                  .removeOrganizationMember(route.params.orgId, member.uid)
                  .then(load)
                  .catch((err) => setError(apiErrorMessage(err, t("orgs.loadError"))));
              }}
            />
          ) : null}
        </View>
      ))}
      {org?.canManage ? (
        <View style={styles.card}>
          <Field label={t("invites.email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
          <View style={styles.row}>
            {["member", "admin"].map((id) => (
              <Choice key={id} label={id} on={role === id} onPress={() => setRole(id)} />
            ))}
          </View>
          <View style={styles.row}>
            {DEPARTMENTS.map((id) => (
              <Choice key={id} label={t(`orgs.dept.${id}` as "orgs.dept.general")} on={department === id} onPress={() => setDepartment(id)} />
            ))}
          </View>
          <Ghost
            label={t("orgs.add")}
            onPress={() => {
              api
                .addOrganizationMember(route.params.orgId, { email: email.trim(), role, department })
                .then(() => {
                  setEmail("");
                  return load();
                })
                .catch((err) => setError(apiErrorMessage(err, t("orgs.loadError"))));
            }}
          />
        </View>
      ) : null}
      <Text style={styles.title}>{t("orgs.share")}</Text>
      {exams.map((exam) => (
        <Ghost
          key={exam.id}
          label={exam.title}
          onPress={() => {
            api
              .shareExamWithOrganization(route.params.orgId, exam.id)
              .then(() => setNotice(t("orgs.shared")))
              .catch((err) => setError(apiErrorMessage(err, t("orgs.loadError"))));
          }}
        />
      ))}
    </StaffBody>
  );
}
