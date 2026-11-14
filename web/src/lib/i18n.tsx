// English / Arabic UI strings with a one-click toggle (RTL for Arabic).
// Self-contained on purpose: to go English-only, remove <LangToggle /> from Shell.tsx and
// mobile/MobileShell.tsx — everything falls back to English.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'ar'

const en = {
  'nav.map': 'Map', 'nav.analytics': 'Analytics', 'nav.drones': 'Drones', 'nav.about': 'About',
  'app.name': 'Fire Guardian',
  'hero.a': 'Detect.', 'hero.b': 'Predict.', 'hero.c': 'Protect.',
  'hero.sub': 'Live wildfire monitoring for Saudi Arabia from NASA satellites.',
  'status.live': 'Live', 'status.connecting': 'Connecting', 'status.offline': 'Offline', 'status.mock': 'Test data',
  'lang.switch': 'العربية',

  'mode.live': 'Live fires', 'mode.forecast': 'Forecast', 'mode.danger': 'Danger zones',
  'mode.live.hint': 'Fires spotted by NASA satellites',
  'mode.forecast.hint': 'Where fires are likely',
  'mode.danger.hint': 'Only the most dangerous areas',

  'legend.title': 'On the map',
  'legend.fire': 'Fire seen by satellite',
  'legend.fire.big': 'Bigger icon = stronger fire',
  'legend.flare': 'Industrial heat (not a fire)',
  'legend.season': 'Fires are common here this month',
  'legend.ai': 'AI forecast for tomorrow (southwest)',
  'legend.zone': 'Burns most years this month',
  'legend.aiHigh': 'AI: high risk tomorrow',
  'legend.you': 'Selected place',
  'level.low': 'Low', 'level.elevated': 'Medium', 'level.high': 'High',

  'win.1': 'Last 24 h', 'win.2': 'Last 2 days', 'win.5': 'Last 5 days',
  'live.count': 'Fires detected', 'live.none': 'No fires detected in this period.',
  'live.none.sub': 'Satellites pass several times a day. New detections appear here automatically.',
  'live.updated': 'Updated {time} · NASA FIRMS (NOAA-20/21 VIIRS)',
  'live.filtered': 'Industrial heat sources filtered out: {n}',
  'live.showFiltered': 'Show filtered industrial heat',
  'live.list': 'Fires', 'live.tap': 'Tap a fire on the map or in the list for details.',
  'fire.small': 'Small', 'fire.moderate': 'Moderate', 'fire.strong': 'Strong',
  'fire.ago.h': '{n} h ago', 'fire.ago.m': '{n} min ago', 'fire.ago.d': '{n} days ago',
  'fire.title': 'Selected fire', 'fire.points': 'Satellite detections: {n}',
  'fire.thermal': 'Satellite infrared view', 'fire.temp': 'Pixel temperature {t}°C',
  'fire.thermal.note': 'NASA VIIRS image of the area; orange dots are the detections.',
  'fire.drone': 'Simulate drone response',
  'fire.unknownPlace': 'Saudi Arabia',

  'wx.title': 'Weather', 'wx.wind': 'Wind', 'wx.humidity': 'Humidity', 'wx.temp': 'Temperature',
  'wx.hint': 'Tap anywhere on the map to check the weather there.',
  'wx.dry': 'Dry and windy: a fire here could spread quickly.',
  'wx.unavailable': 'Weather is unavailable right now.', 'wx.mock': 'test data',

  'fc.ai.title': 'Tomorrow · AI forecast', 'fc.ai.area': 'Southwest pilot area: Jazan, Asir, Al Baha',
  'fc.ai.counts': 'High: {h} · Medium: {m} · Low: {l}',
  'fc.ai.top': 'Highest area', 'fc.ai.selected': 'Selected area',
  'fc.ai.meaning.high': 'More likely than usual that satellites spot a fire here tomorrow.',
  'fc.ai.meaning.elevated': 'Somewhat more likely than usual that satellites spot a fire here tomorrow.',
  'fc.ai.meaning.low': 'Unlikely that satellites spot a fire here tomorrow.',
  'fc.ai.hit': 'Last year, {p}% of “{level}” days had a fire detection.',
  'fc.ai.reliable': 'How reliable is this?', 'fc.ai.focus': 'Show on map',
  'fc.ai.note': 'Research prototype, not an official warning.',
  'fc.ai.unavailable': 'The AI forecast is unavailable right now (NASA weather data missing).',
  'fc.season.title': 'This month · where fires usually happen',
  'fc.season.text': 'From 14 years of NASA satellite records, fires in {month} are most common in:',
  'fc.season.areas': 'areas', 'fc.season.zone': 'In {p}% of years this area had a fire in {month}.',

  'dg.title': 'Danger zones', 'dg.count': 'High-danger areas',
  'dg.explain': 'Shown: fires burning now, places that burn most years in {month}, and areas the AI rates high for tomorrow.',
  'dg.fires': 'Fires burning now', 'dg.ai': 'High risk tomorrow (AI)', 'dg.season': 'Usually burns in {month}',
  'dg.none': 'No high-danger areas right now.',

  'drones.title': 'Drone response', 'drones.sim': 'Simulation',
  'drones.sub': 'A what-if demo: how a drone fleet could respond to the fires and risk areas on the map. Simulated drones, made-up bases, no real hardware.',
  'drones.export': 'Export missions (.plan)', 'drones.fleet': 'Fleet', 'drones.log': 'Mission log', 'drones.bases': 'Drone bases',
  'drones.onMission': '{n} of {t} drones on a mission',
  'drones.auto': 'Auto-response', 'drones.on': 'On', 'drones.off': 'Off', 'drones.deployA': 'Send fire squad', 'drones.deployB': 'Send cooling squad',
  'drones.sent': '{n} drone(s) sent.', 'drones.noneFree': 'No free drone in range of a new target.',
  'drones.feedNote': 'Simulated camera: a satellite photo of the target with a drone overlay. No real camera or drone.',
  'drones.noneAirborne': 'No drone in the air.',

  'an.title1': 'Two satellites.', 'an.title2': 'One fire record.',
  'an.sub': 'MODIS (2001→) and VIIRS (2012→) merged into one consistent monthly record of fire activity, with gas flares and industrial heat removed.',
  'an.tab.calendar': 'Fire calendar', 'an.tab.method': 'Harmonization & validation', 'an.tab.ai': 'AI model',
  'an.enOnly': 'The detailed charts below are in English.',

  'footer.motto': 'Monitoring a safer tomorrow', 'footer.powered': 'Powered by NASA Earth observation · FIRMS · GIBS · POWER · Weather by Meteomatics',
  'common.loading': 'Loading…', 'common.close': 'Close', 'common.details': 'Details',
} as const

export type Key = keyof typeof en

const ar: Record<Key, string> = {
  'nav.map': 'الخريطة', 'nav.analytics': 'التحليلات', 'nav.drones': 'المسيّرات', 'nav.about': 'عن المشروع',
  'app.name': 'حارس الحرائق',
  'hero.a': 'رصد.', 'hero.b': 'تنبؤ.', 'hero.c': 'حماية.',
  'hero.sub': 'رصد مباشر لحرائق الغطاء النباتي في المملكة العربية السعودية عبر أقمار ناسا.',
  'status.live': 'مباشر', 'status.connecting': 'جارٍ الاتصال', 'status.offline': 'غير متصل', 'status.mock': 'بيانات تجريبية',
  'lang.switch': 'English',

  'mode.live': 'الحرائق الآن', 'mode.forecast': 'التوقعات', 'mode.danger': 'مناطق الخطر',
  'mode.live.hint': 'حرائق رصدتها أقمار ناسا',
  'mode.forecast.hint': 'أين يُحتمل حدوث الحرائق',
  'mode.danger.hint': 'المناطق الأشد خطراً فقط',

  'legend.title': 'دليل الخريطة',
  'legend.fire': 'حريق رصده القمر الصناعي',
  'legend.fire.big': 'الأيقونة الأكبر = حريق أقوى',
  'legend.flare': 'حرارة صناعية (ليست حريقاً)',
  'legend.season': 'تكثر الحرائق هنا هذا الشهر',
  'legend.ai': 'توقع الذكاء الاصطناعي للغد (الجنوب الغربي)',
  'legend.zone': 'تحترق معظم السنوات في هذا الشهر',
  'legend.aiHigh': 'ذكاء اصطناعي: خطر مرتفع غداً',
  'legend.you': 'المكان المحدد',
  'level.low': 'منخفض', 'level.elevated': 'متوسط', 'level.high': 'مرتفع',

  'win.1': 'آخر 24 ساعة', 'win.2': 'آخر يومين', 'win.5': 'آخر 5 أيام',
  'live.count': 'الحرائق المرصودة', 'live.none': 'لم تُرصد حرائق في هذه الفترة.',
  'live.none.sub': 'تمر الأقمار الصناعية عدة مرات يومياً، وتظهر الرصود الجديدة هنا تلقائياً.',
  'live.updated': 'آخر تحديث {time} · ناسا FIRMS (أقمار NOAA-20/21)',
  'live.filtered': 'مصادر حرارة صناعية مستبعدة: {n}',
  'live.showFiltered': 'إظهار الحرارة الصناعية المستبعدة',
  'live.list': 'الحرائق', 'live.tap': 'اضغط على حريق في الخريطة أو القائمة لعرض التفاصيل.',
  'fire.small': 'صغير', 'fire.moderate': 'متوسط', 'fire.strong': 'قوي',
  'fire.ago.h': 'قبل {n} ساعة', 'fire.ago.m': 'قبل {n} دقيقة', 'fire.ago.d': 'قبل {n} أيام',
  'fire.title': 'الحريق المحدد', 'fire.points': 'رصود الأقمار: {n}',
  'fire.thermal': 'صورة الأقمار بالأشعة تحت الحمراء', 'fire.temp': 'حرارة البكسل {t}°م',
  'fire.thermal.note': 'صورة من القمر VIIRS التابع لناسا؛ النقاط البرتقالية هي الرصود.',
  'fire.drone': 'محاكاة استجابة المسيّرات',
  'fire.unknownPlace': 'المملكة العربية السعودية',

  'wx.title': 'الطقس', 'wx.wind': 'الرياح', 'wx.humidity': 'الرطوبة', 'wx.temp': 'الحرارة',
  'wx.hint': 'اضغط على أي مكان في الخريطة لمعرفة الطقس فيه.',
  'wx.dry': 'جو جاف ورياح نشطة: قد ينتشر أي حريق هنا بسرعة.',
  'wx.unavailable': 'بيانات الطقس غير متاحة حالياً.', 'wx.mock': 'بيانات تجريبية',

  'fc.ai.title': 'الغد · توقع الذكاء الاصطناعي', 'fc.ai.area': 'المنطقة التجريبية جنوب غرب المملكة: جازان وعسير والباحة',
  'fc.ai.counts': 'مرتفع: {h} · متوسط: {m} · منخفض: {l}',
  'fc.ai.top': 'المنطقة الأعلى', 'fc.ai.selected': 'المنطقة المحددة',
  'fc.ai.meaning.high': 'احتمال أعلى من المعتاد أن ترصد الأقمار حريقاً هنا غداً.',
  'fc.ai.meaning.elevated': 'احتمال أعلى قليلاً من المعتاد أن ترصد الأقمار حريقاً هنا غداً.',
  'fc.ai.meaning.low': 'من غير المرجح أن ترصد الأقمار حريقاً هنا غداً.',
  'fc.ai.hit': 'في العام الماضي، رُصد حريق في {p}% من الأيام المصنفة «{level}».',
  'fc.ai.reliable': 'ما مدى دقة هذا التوقع؟', 'fc.ai.focus': 'عرض على الخريطة',
  'fc.ai.note': 'نموذج بحثي تجريبي، وليس تحذيراً رسمياً.',
  'fc.ai.unavailable': 'توقع الذكاء الاصطناعي غير متاح حالياً (بيانات طقس ناسا غير متوفرة).',
  'fc.season.title': 'هذا الشهر · أين تحدث الحرائق عادةً',
  'fc.season.text': 'بحسب سجلات أقمار ناسا لـ14 عاماً، تكثر الحرائق في شهر {month} في:',
  'fc.season.areas': 'مناطق', 'fc.season.zone': 'شهدت هذه المنطقة حريقاً في شهر {month} في {p}% من السنوات.',

  'dg.title': 'مناطق الخطر', 'dg.count': 'المناطق عالية الخطورة',
  'dg.explain': 'المعروض: الحرائق المشتعلة الآن، والأماكن التي تحترق غالباً في شهر {month}، والمناطق التي يصنفها الذكاء الاصطناعي عالية الخطورة غداً.',
  'dg.fires': 'حرائق مشتعلة الآن', 'dg.ai': 'خطر مرتفع غداً (ذكاء اصطناعي)', 'dg.season': 'تحترق عادة في {month}',
  'dg.none': 'لا توجد مناطق عالية الخطورة حالياً.',

  'drones.title': 'استجابة المسيّرات', 'drones.sim': 'محاكاة',
  'drones.sub': 'عرض افتراضي: كيف يمكن لأسطول من الطائرات المسيّرة الاستجابة للحرائق ومناطق الخطر على الخريطة. المسيّرات والقواعد افتراضية ولا يوجد عتاد حقيقي.',
  'drones.export': 'تصدير المهام (.plan)', 'drones.fleet': 'الأسطول', 'drones.log': 'سجل المهام', 'drones.bases': 'قواعد المسيّرات',
  'drones.onMission': '{n} من {t} مسيّرة في مهمة',
  'drones.auto': 'الاستجابة التلقائية', 'drones.on': 'مفعّلة', 'drones.off': 'متوقفة', 'drones.deployA': 'إرسال فريق الإطفاء', 'drones.deployB': 'إرسال فريق التبريد',
  'drones.sent': 'أُرسلت مسيّرات: {n}', 'drones.noneFree': 'لا توجد مسيّرة متاحة ضمن المدى لهدف جديد.',
  'drones.feedNote': 'كاميرا افتراضية: صورة فضائية للهدف مع واجهة المسيّرة. لا توجد كاميرا أو مسيّرة حقيقية.',
  'drones.noneAirborne': 'لا توجد مسيّرة في الجو.',

  'an.title1': 'قمران صناعيان.', 'an.title2': 'سجل حرائق واحد.',
  'an.sub': 'دمج رصد القمرين MODIS (منذ 2001) وVIIRS (منذ 2012) في سجل شهري موحّد لنشاط الحرائق، مع استبعاد شعلات الغاز والحرارة الصناعية.',
  'an.tab.calendar': 'تقويم الحرائق', 'an.tab.method': 'الدمج والتحقق', 'an.tab.ai': 'نموذج الذكاء الاصطناعي',
  'an.enOnly': 'الرسوم البيانية التفصيلية أدناه باللغة الإنجليزية.',

  'footer.motto': 'نرصد من أجل غدٍ أكثر أماناً', 'footer.powered': 'مدعوم ببيانات رصد الأرض من ناسا · FIRMS · GIBS · POWER · الطقس من Meteomatics',
  'common.loading': 'جارٍ التحميل…', 'common.close': 'إغلاق', 'common.details': 'التفاصيل',
}

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const PLACES_AR: Record<string, string> = {
  'Saudi Arabia': 'المملكة العربية السعودية', KSA: 'السعودية', 'SW KSA': 'جنوب غرب المملكة',
  Riyadh: 'الرياض', Makkah: 'مكة المكرمة', 'Al Madinah': 'المدينة المنورة', 'Eastern Province': 'المنطقة الشرقية',
  'Al-Qassim': 'القصيم', "Ha'il": 'حائل', Tabuk: 'تبوك', 'Northern Borders': 'الحدود الشمالية', Jazan: 'جازان',
  Najran: 'نجران', 'Al Baha': 'الباحة', 'Al Jawf': 'الجوف', Asir: 'عسير',
}

interface I18n {
  lang: Lang
  dir: 'ltr' | 'rtl'
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Record<string, string | number>) => string
  month: (i: number) => string
  place: (name: string | null | undefined) => string
  latlon: (lat: number, lon: number) => string
}

const Ctx = createContext<I18n | null>(null)
const read = (): Lang => {
  try { return localStorage.getItem('fg-lang') === 'ar' ? 'ar' : 'en' } catch { return 'en' }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(read)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('fg-lang', l) } catch { /* private mode */ }
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])
  const value = useMemo<I18n>(() => {
    const dict: Record<Key, string> = lang === 'ar' ? ar : en
    return {
      lang, dir: lang === 'ar' ? 'rtl' : 'ltr', setLang,
      t: (key, vars) => {
        let s = dict[key] ?? en[key] ?? key
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
        return s
      },
      month: (i) => (lang === 'ar' ? MONTHS_AR : MONTHS_EN)[i],
      place: (name) => (!name ? dict['fire.unknownPlace'] : lang === 'ar' ? PLACES_AR[name] ?? name : name),
      latlon: (lat, lon) => (lang === 'ar'
        ? `${lat.toFixed(2)}° شمالاً، ${lon.toFixed(2)}° شرقاً`
        : `${lat.toFixed(2)}°N ${lon.toFixed(2)}°E`),
    }
  }, [lang, setLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useT() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useT outside I18nProvider')
  return c
}

/** Language switch button. Remove its usages to make the site English-only. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useT()
  return (
    <button
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={`inline-flex h-9 items-center rounded-full border border-line-strong px-3 text-[13px] text-ink hover:bg-white/[0.06] cursor-pointer ${className}`}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      lang={lang === 'ar' ? 'en' : 'ar'}
    >
      {t('lang.switch')}
    </button>
  )
}
