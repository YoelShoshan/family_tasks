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

    abandonLabel: (title) => `ויתור על ${title}`,
    restoreLabel: (title) => `החזרת ${title}`,
    abandoned: "ויתרת",
    celebrate: "כל הכבוד!",
    celebrateAll: "סיימת הכל להיום!",
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

    collections: "סטים",
    applySet: "הוספת הסט",
    newSetName: "שם הסט (יום שישי, יום לימודים)",
    createSet: "יצירת סט",
    noSets: "אין עדיין סטים. סט הוא קבוצת משימות שמוסיפים בלחיצה אחת.",
    setTasks: (n) => `${n} משימות`,
    editSet: "עריכת הסט",
    renameSet: "שינוי שם",
    deleteSet: "מחיקת הסט",
    confirmDeleteSet: (name) => `למחוק את הסט "${name}"? המשימות עצמן יישארו.`,
    doneEditing: "סיום",
    pickForSet: "סמנו אילו משימות שייכות לסט",
    setApplied: (n) => `נוספו ${n} משימות`,
    statsBtn: "התקדמות",
    statsTitle: (name) => `${name} · התקדמות`,
    thisWeek: "השבוע",
    last4Weeks: "4 השבועות האחרונים",
    completedCount: "הושלמו",
    activeDays: "ימים פעילים",
    bestStreakless: "הכי הרבה בשבוע",
    perTask: "לפי משימה",
    timesDone: (n) => `${n} פעמים`,
    lastDone: (d) => `לאחרונה: ${d}`,
    neverDone: "עוד לא",
    noHistory: "עוד אין מספיק היסטוריה. חזרו אחרי כמה ימים.",
    heatmapTitle: "8 השבועות האחרונים",
    daysShort: ["א", "ב", "ג", "ד", "ה", "ו", "ש"],
    trendTitle: "30 הימים האחרונים",
    legendDone: "הושלמו",
    legendPlanned: "תוכננו",
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

    abandonLabel: (title) => `Give up on ${title}`,
    restoreLabel: (title) => `Restore ${title}`,
    abandoned: "gave up",
    celebrate: "Nice one!",
    celebrateAll: "That's everything for today!",
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

    collections: "Sets",
    applySet: "Add set",
    newSetName: "Set name (Friday, school day)",
    createSet: "Create set",
    noSets: "No sets yet. A set is a group of tasks you add in one tap.",
    setTasks: (n) => `${n} tasks`,
    editSet: "Edit set",
    renameSet: "Rename",
    deleteSet: "Delete set",
    confirmDeleteSet: (name) => `Delete the set "${name}"? The tasks themselves stay.`,
    doneEditing: "Done",
    pickForSet: "Choose which tasks belong to this set",
    setApplied: (n) => `Added ${n} tasks`,
    statsBtn: "Progress",
    statsTitle: (name) => `${name} · progress`,
    thisWeek: "This week",
    last4Weeks: "Last 4 weeks",
    completedCount: "Completed",
    activeDays: "Active days",
    bestStreakless: "Best week",
    perTask: "By task",
    timesDone: (n) => `${n} times`,
    lastDone: (d) => `Last: ${d}`,
    neverDone: "Not yet",
    noHistory: "Not enough history yet. Come back in a few days.",
    heatmapTitle: "Last 8 weeks",
    daysShort: ["S", "M", "T", "W", "T", "F", "S"],
    trendTitle: "Last 30 days",
    legendDone: "Completed",
    legendPlanned: "Planned",
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
