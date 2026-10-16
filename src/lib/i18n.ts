"use client";

import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const LOCALES = {
  en: "English",
  fil: "Filipino",
  es: "Español",
} as const;
export type Locale = keyof typeof LOCALES;

const en = {
  "nav.overview": "Overview",
  "nav.proctoring": "Proctoring",
  "nav.exams": "Exams",
  "nav.questionBank": "Question Bank",
  "nav.bundles": "Exam Bundles",
  "nav.invitations": "Invitations",
  "nav.groups": "Examinee Groups",
  "nav.results": "Results",
  "nav.myExamsSection": "My exams",
  "nav.myExams": "My Exams",
  "nav.myResults": "My Results",
  "nav.practice": "Practice",
  "nav.join": "Join a Group",
  "nav.becomeProctor": "Become a Proctor",
  "nav.admin": "Admin",
  "nav.questionTypes": "Question Types",
  "nav.proctorRequests": "Proctor Requests",
  "nav.account": "Account",
  "nav.settings": "Settings",
  "menu.profile": "Profile",
  "menu.logout": "Log out",
  "menu.language": "Language",
  "header.welcome": "Welcome back, {name}",
  "exam.submit": "Submit",
  "exam.previous": "Previous",
  "exam.next": "Next",
  "exam.finish": "Finish",
  "exam.andSubmit": " & Submit",
  "exam.flagged": "Flagged",
  "exam.submitTitle": "Submit Exam?",
  "exam.answeredOf": "You have answered {answered} out of {total} questions in {scope}.",
  "exam.thisExam": "this exam",
  "exam.unansweredWarning": "Warning: {count} question(s) are unanswered.",
  "exam.partsNote": "Note: You can switch between parts using the tabs above.",
  "exam.flaggedCount": "You have {count} flagged question(s).",
  "exam.cannotUndo": "This action cannot be undone.",
  "exam.continue": "Continue Exam",
  "exam.submitExam": "Submit Exam",
  "exam.submitting": "Submitting your exam",
  "exam.submittingWait": "Your exam is still being submitted. Please wait and do not close this page or navigate away.",
};
export type MessageKey = keyof typeof en;

const fil: Record<MessageKey, string> = {
  "nav.overview": "Pangkalahatang-ideya",
  "nav.proctoring": "Pagbabantay",
  "nav.exams": "Mga Pagsusulit",
  "nav.questionBank": "Bangko ng Tanong",
  "nav.bundles": "Mga Bundle ng Pagsusulit",
  "nav.invitations": "Mga Imbitasyon",
  "nav.groups": "Mga Grupo ng Kukuha",
  "nav.results": "Mga Resulta",
  "nav.myExamsSection": "Aking mga pagsusulit",
  "nav.myExams": "Aking mga Pagsusulit",
  "nav.myResults": "Aking mga Resulta",
  "nav.practice": "Pagsasanay",
  "nav.join": "Sumali sa Grupo",
  "nav.becomeProctor": "Maging Proctor",
  "nav.admin": "Admin",
  "nav.questionTypes": "Mga Uri ng Tanong",
  "nav.proctorRequests": "Mga Kahilingan ng Proctor",
  "nav.account": "Account",
  "nav.settings": "Mga Setting",
  "menu.profile": "Profile",
  "menu.logout": "Mag-log out",
  "menu.language": "Wika",
  "header.welcome": "Maligayang pagbabalik, {name}",
  "exam.submit": "Ipasa",
  "exam.previous": "Nakaraan",
  "exam.next": "Susunod",
  "exam.finish": "Tapusin",
  "exam.andSubmit": " at Ipasa",
  "exam.flagged": "May marka",
  "exam.submitTitle": "Ipasa ang Pagsusulit?",
  "exam.answeredOf": "Nasagutan mo ang {answered} sa {total} na tanong sa {scope}.",
  "exam.thisExam": "pagsusulit na ito",
  "exam.unansweredWarning": "Babala: {count} tanong ang hindi pa nasasagutan.",
  "exam.partsNote": "Paalala: Maaari kang lumipat sa ibang bahagi gamit ang mga tab sa itaas.",
  "exam.flaggedCount": "Mayroon kang {count} tanong na may marka.",
  "exam.cannotUndo": "Hindi na ito maaaring bawiin.",
  "exam.continue": "Ituloy ang Pagsusulit",
  "exam.submitExam": "Ipasa ang Pagsusulit",
  "exam.submitting": "Ipinapasa ang iyong pagsusulit",
  "exam.submittingWait": "Ipinapasa pa ang iyong pagsusulit. Maghintay at huwag isara o iwan ang pahinang ito.",
};

const es: Record<MessageKey, string> = {
  "nav.overview": "Resumen",
  "nav.proctoring": "Supervisión",
  "nav.exams": "Exámenes",
  "nav.questionBank": "Banco de preguntas",
  "nav.bundles": "Paquetes de exámenes",
  "nav.invitations": "Invitaciones",
  "nav.groups": "Grupos de examinados",
  "nav.results": "Resultados",
  "nav.myExamsSection": "Mis exámenes",
  "nav.myExams": "Mis exámenes",
  "nav.myResults": "Mis resultados",
  "nav.practice": "Práctica",
  "nav.join": "Unirse a un grupo",
  "nav.becomeProctor": "Ser supervisor",
  "nav.admin": "Administración",
  "nav.questionTypes": "Tipos de pregunta",
  "nav.proctorRequests": "Solicitudes de supervisor",
  "nav.account": "Cuenta",
  "nav.settings": "Configuración",
  "menu.profile": "Perfil",
  "menu.logout": "Cerrar sesión",
  "menu.language": "Idioma",
  "header.welcome": "Bienvenido de nuevo, {name}",
  "exam.submit": "Enviar",
  "exam.previous": "Anterior",
  "exam.next": "Siguiente",
  "exam.finish": "Terminar",
  "exam.andSubmit": " y enviar",
  "exam.flagged": "Marcada",
  "exam.submitTitle": "¿Enviar el examen?",
  "exam.answeredOf": "Has respondido {answered} de {total} preguntas en {scope}.",
  "exam.thisExam": "este examen",
  "exam.unansweredWarning": "Atención: {count} pregunta(s) sin responder.",
  "exam.partsNote": "Nota: puedes cambiar de parte con las pestañas de arriba.",
  "exam.flaggedCount": "Tienes {count} pregunta(s) marcada(s).",
  "exam.cannotUndo": "Esta acción no se puede deshacer.",
  "exam.continue": "Continuar examen",
  "exam.submitExam": "Enviar examen",
  "exam.submitting": "Enviando tu examen",
  "exam.submittingWait": "Tu examen se está enviando. Espera y no cierres ni abandones esta página.",
};

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, fil, es };

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  // Rehydrated after mount so server-rendered English markup matches the first client render
  persist((set) => ({ locale: "en", setLocale: (locale) => set({ locale }) }), { name: "xebra:locale", skipHydration: true })
);

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = MESSAGES[locale]?.[key] ?? en[key];
  return vars ? template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : template;
}

/** Translator for the user's chosen interface language; also keeps <html lang> in sync. */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  useEffect(() => {
    if (!useLocaleStore.persist.hasHydrated()) useLocaleStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
}
