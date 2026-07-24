// UI strings. Add a key here and use t("key") in app.js.
// Sunday-first week order throughout.

export const STRINGS = {
  he: {
    dir: "rtl",
    appTitle: "לוח המשפחה",
    loginSub: "התחברו פעם אחת. המכשיר יישאר מחובר.",
    email: "אימייל",
    password: "סיסמה",
    signIn: "כניסה",
    errNotConfirmed: "החשבון עדיין לא אושר. אשרו אותו ב-Supabase תחת Authentication ← Users.",
    errBadLogin: "האימייל והסיסמה לא תואמים לחשבון קיים.",
    errNoServer: "אין חיבור לשרת. בדקו את SUPABASE_URL בקובץ config.js.",

    todayEyebrow: "היום",
    notPlanned: "עוד לא תוכנן",

    back: "חזרה",
    backToEveryone: "חזרה לכולם",
    backToBoard: "חזרה ללוח",
    tasksBtn: "משימות",
    planBtn: "תכנון",

    emptyToday: "אין משימות להיום. פתחו <b>תכנון</b> ובחרו מה לעשות.",
    removeFromToday: (title) => `הסרת ${title} מהיום`,

    addToToday: "הוספה להיום",
    searchTasks: "חיפוש משימות",
    allTags: "הכל",
    noMatch: "אין משימות שמתאימות לסינון.",
    allChosen: "כל המשימות הזמינות כבר ברשימה של היום.",
    kindAnytime: "מתי שבא",
    kindDaily: "יומי",

    manageTitle: (name) => `${name} · משימות`,
    emptyPool: "אין עדיין משימות. הוסיפו את הראשונה למטה.",
    newTask: "משימה חדשה",
    tagsPlaceholder: "תגיות, מופרדות בפסיק (בית, לימודים)",
    recurring: "חוזרת",
    general: "פרויקט מתי שבא",
    addTask: "הוספת משימה",
    saveChanges: "שמירת שינויים",
    cancel: "ביטול",
    deleteLabel: (title) => `מחיקת ${title}`,
    confirmDelete: (title) => `למחוק את "${title}"? גם ההיסטוריה שלה תימחק.`,
    saveFailed: "לא הצלחנו לשמור את המשימה.",

    anyDay: "כל יום",
    everyDay: "כל יום",
    days: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
    langBtn: "EN",
  },

  en: {
    dir: "ltr",
    appTitle: "Family Board",
    loginSub: "Sign in once. This device stays signed in.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    errNotConfirmed:
      "This account isn't confirmed yet. Confirm it in Supabase under Authentication → Users.",
    errBadLogin: "That email and password don't match an account.",
    errNoServer: "Can't reach the server. Check SUPABASE_URL in config.js.",

    todayEyebrow: "Today",
    notPlanned: "Not planned yet",

    back: "Back",
    backToEveryone: "Back to everyone",
    backToBoard: "Back to board",
    tasksBtn: "Tasks",
    planBtn: "Plan",

    emptyToday: "Nothing planned for today. Open <b>Plan</b> to pick what you'll do.",
    removeFromToday: (title) => `Remove ${title} from today`,

    addToToday: "Add to today",
    searchTasks: "Search tasks",
    allTags: "All",
    noMatch: "No tasks match this filter.",
    allChosen: "Everything available is already on today's list.",
    kindAnytime: "anytime",
    kindDaily: "daily",

    manageTitle: (name) => `${name} · tasks`,
    emptyPool: "No tasks yet. Add the first one below.",
    newTask: "New task",
    tagsPlaceholder: "Tags, comma separated (school, home)",
    recurring: "Recurring",
    general: "Anytime project",
    addTask: "Add task",
    saveChanges: "Save changes",
    cancel: "Cancel",
    deleteLabel: (title) => `Delete ${title}`,
    confirmDelete: (title) => `Delete "${title}"? Its history will be removed too.`,
    saveFailed: "Could not save that task.",

    anyDay: "any day",
    everyDay: "every day",
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    langBtn: "עב",
  },
};

const LANG_KEY = "familyboard.lang";

export function getLang() {
  return localStorage.getItem(LANG_KEY) || "he"; // Hebrew is the default
}

export function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
}

export function makeT(lang) {
  const table = STRINGS[lang] || STRINGS.he;
  return (key, ...args) => {
    const v = table[key];
    return typeof v === "function" ? v(...args) : v;
  };
}
