import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiErrorMessage } from "../api";
import { useT } from "../i18n";
import { Choice, Field, Ghost, Primary, StaffBody, useStaffStyles } from "../staff-ui";
import type { Exam, ExamBundle, ExamInvitation, ExamineeGroup } from "../types";

type Mode = "person" | "group" | "bundle" | "bundleGroup";

export function InvitationsScreen() {
  const t = useT();
  const { styles } = useStaffStyles();
  const [mode, setMode] = useState<Mode>("person");
  const [items, setItems] = useState<ExamInvitation[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [groups, setGroups] = useState<ExamineeGroup[]>([]);
  const [bundles, setBundles] = useState<ExamBundle[]>([]);
  const [email, setEmail] = useState("");
  const [days, setDays] = useState("7");
  const [attempts, setAttempts] = useState("1");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  const [note, setNote] = useState("");
  const [examId, setExamId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [invites, examList, groupList, bundleList] = await Promise.all([
        api.getExamInvitations(),
        api.getExams({ page: 1, size: 100 }),
        api.getExamineeGroups(),
        api.getExamBundles(),
      ]);
      setItems(invites.data || []);
      setExams(examList.data || []);
      setGroups(groupList.data || []);
      setBundles(bundleList.data || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, t("invites.loadError")));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  function when(value: string) {
    const parsed = new Date(value.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  async function send() {
    const expiresAt = new Date(Date.now() + (Number(days) || 7) * 86400000).toISOString();
    const maxAttempts = Number(attempts) || 1;
    const timing = {
      expiresAt,
      maxAttempts,
      ...(when(start) ? { scheduledStartTime: when(start) } : {}),
      ...(when(end) ? { scheduledEndTime: when(end) } : {}),
      ...(multiplier > 1 || note.trim()
        ? { accommodations: { timeMultiplier: multiplier, note: note.trim() || null } }
        : {}),
    };
    setError("");
    try {
      if (mode === "person") await api.createExamInvitation({ examId, examineeEmail: email.trim(), ...timing });
      if (mode === "group") await api.createGroupInvitation({ examId, groupId, ...timing });
      if (mode === "bundle") await api.createBundleInvitation({ bundleId, examineeEmail: email.trim(), ...timing });
      if (mode === "bundleGroup") await api.createBundleGroupInvitation({ bundleId, groupId, ...timing });
      setNotice(t("invites.sent"));
      setEmail("");
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t("invites.loadError")));
    }
  }

  return (
    <StaffBody>
      <View style={styles.row}>
        <Choice label={t("invites.person")} on={mode === "person"} onPress={() => setMode("person")} />
        <Choice label={t("invites.group")} on={mode === "group"} onPress={() => setMode("group")} />
        <Choice label={t("invites.bundle")} on={mode === "bundle"} onPress={() => setMode("bundle")} />
        <Choice label={t("invites.bundleGroup")} on={mode === "bundleGroup"} onPress={() => setMode("bundleGroup")} />
      </View>
      {mode === "person" || mode === "group" ? (
        <View style={styles.row}>
          {exams.map((exam) => (
            <Choice key={exam.id} label={exam.title} on={examId === exam.id} onPress={() => setExamId(exam.id)} />
          ))}
        </View>
      ) : null}
      {mode === "bundle" || mode === "bundleGroup" ? (
        <View style={styles.row}>
          {bundles.map((bundle) => (
            <Choice key={bundle.id} label={bundle.name} on={bundleId === bundle.id} onPress={() => setBundleId(bundle.id)} />
          ))}
        </View>
      ) : null}
      {mode === "group" || mode === "bundleGroup" ? (
        <View style={styles.row}>
          {groups.map((group) => (
            <Choice key={group.id} label={group.name} on={groupId === group.id} onPress={() => setGroupId(group.id)} />
          ))}
        </View>
      ) : null}
      {mode === "person" || mode === "bundle" ? (
        <Field label={t("invites.email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
      ) : null}
      <Field label={t("invites.days")} value={days} onChangeText={setDays} keyboardType="number-pad" />
      <Field label={t("invites.attempts")} value={attempts} onChangeText={setAttempts} keyboardType="number-pad" />
      <Field label={t("invites.start")} value={start} onChangeText={setStart} placeholder="2026-10-21 09:00" />
      <Field label={t("invites.end")} value={end} onChangeText={setEnd} placeholder="2026-10-21 10:00" />
      <Text style={styles.muted}>{t("invites.extraTime")}</Text>
      <View style={styles.row}>
        {[
          [1, "invites.standard"],
          [1.25, "invites.quarter"],
          [1.5, "invites.half"],
          [2, "invites.double"],
          [3, "invites.triple"],
        ].map(([value, label]) => (
          <Choice
            key={String(value)}
            label={t(label as "invites.standard")}
            on={multiplier === value}
            onPress={() => setMultiplier(Number(value))}
          />
        ))}
      </View>
      <Field label={t("invites.note")} value={note} onChangeText={setNote} />
      <Primary label={t("invites.send")} onPress={send} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      {items.length === 0 ? <Text style={styles.muted}>{t("invites.none")}</Text> : null}
      {items.map((invite) => (
        <View key={invite.id} style={styles.card}>
          <Text style={styles.title}>{invite.examineeEmail || invite.groupName || invite.examineeName || invite.id}</Text>
          <Text style={styles.muted}>{invite.examTitle || invite.bundleName || ""}</Text>
          <Text style={styles.muted}>{invite.status}</Text>
          <Ghost
            label={t("invites.accommodation")}
            onPress={() => {
              api
                .updateExamInvitation(invite.id, {
                  accommodations: multiplier > 1 || note.trim() ? { timeMultiplier: multiplier, note: note.trim() || null } : null,
                })
                .then(() => {
                  setNotice(t("settings.saved"));
                  return load();
                })
                .catch((err) => setError(apiErrorMessage(err, t("invites.loadError"))));
            }}
          />
          <Ghost
            label={t("invites.revoke")}
            danger
            onPress={() => {
              api
                .deleteExamInvitation(invite.id)
                .then(load)
                .catch((err) => setError(apiErrorMessage(err, t("invites.loadError"))));
            }}
          />
        </View>
      ))}
    </StaffBody>
  );
}
