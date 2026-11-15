// About: project, how the three sections work, data sources, credits, AI tools used.
// AI-assisted: written with Claude Code (Anthropic) for NASA Space Apps 2026.
import { Panel } from '@/components/ui'
import { useT } from '@/lib/i18n'

/** Arabic version of the About page (remove with the language toggle if going English-only). */
function AboutAr() {
  return (
    <div className="grid max-w-5xl gap-4 px-3 pt-2 sm:px-8 sm:pt-4">
      <Panel title="عن حارس الحرائق">
        <div className="grid gap-3 text-[14px] leading-relaxed text-muted">
          <p>حارس الحرائق هو مشاركتنا في <b className="text-ink">تحدي ناسا لتطبيقات الفضاء 2026</b> ضمن تحدي «دمج رصد النقاط الحرارية من MODIS وVIIRS». يحوّل المشروع جيلين من مستشعرات الحرائق لدى ناسا إلى سجل موحّد للمملكة العربية السعودية، ثم يستخدم هذا السجل مع الرصد المباشر من الأقمار وبيانات الطقس لرصد الحرائق وتحديد المناطق الأكثر خطورة.</p>
          <p className="rounded-lg border border-ember/30 bg-ember-soft p-3 text-ink/90">حارس الحرائق أداة بحثية وتوضيحية، وليس نظام إنذار رسمياً ولا يحل محل الدفاع المدني. صفحة عرض المسيّرات تصوّر مستقبلي: الفيديو رسوم متحركة والأسطول محاكاة، ولم يُختبر أي عتاد حقيقي.</p>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="الحرائق الآن">
          <p className="text-[13.5px] leading-relaxed text-muted">حرائق رصدتها أقمار ناسا (NOAA-20 وNOAA-21) خلال الأيام الأخيرة، بعد استبعاد شعلات الغاز والحرارة الصناعية. تتحدث تلقائياً كل 10 دقائق.</p>
        </Panel>
        <Panel title="مصادر الحرارة">
          <p className="text-[13.5px] leading-relaxed text-muted">معظم النقاط الحرارية في المملكة ليست حرائق بل مصانع ومحطات كهرباء وشعلات غاز. يصنّف الموقع كل نقطة اعتماداً على تصنيفات ناسا لنفس الموقع، وقاعدة GIHS، واستمرار الحرارة لأشهر، ونموذج البصمة الحرارية. اختُبر على أشهر لم يرها: 99.96% من النقاط الصناعية و72% من الحرائق صُنّفت بشكل صحيح.</p>
        </Panel>
        <Panel title="التوقعات">
          <p className="text-[13.5px] leading-relaxed text-muted">النمط الشهري لكل منطقة بحسب سجل 14 عاماً (هذا الشهر والشهر القادم). نموذج الغد التجريبي مخفي افتراضياً لأنه لم يكن أفضل من النمط الشهري في الاختبارات.</p>
        </Panel>
        <Panel title="مناطق الخطر">
          <p className="text-[13.5px] leading-relaxed text-muted">المناطق الأشد خطراً فقط: الحرائق المشتعلة الآن، والأماكن التي تحترق في معظم السنوات في هذا الشهر، والمناطق التي يصنفها النموذج عالية الخطورة غداً.</p>
        </Panel>
      </div>
      <Panel title="مصادر البيانات">
        <ul className="grid gap-1.5 text-[13.5px] text-muted">
          <li><b className="text-ink">ناسا FIRMS</b>: أرشيف ورصد شبه مباشر من MODIS وVIIRS.</li>
          <li><b className="text-ink">ناسا GIBS</b>: خرائط الأساس وصور الأقمار بالأشعة تحت الحمراء.</li>
          <li><b className="text-ink">ناسا POWER</b>: بيانات الطقس اليومية لنموذج الذكاء الاصطناعي.</li>
          <li><b className="text-ink">Meteomatics</b>: الطقس الحالي للمكان المحدد. <b className="text-ink">GIHS</b>: مواقع الحرارة الصناعية. <b className="text-ink">Natural Earth</b>: الحدود.</li>
        </ul>
      </Panel>
      <Panel title="الشكر وأدوات الذكاء الاصطناعي">
        <p className="text-[13.5px] leading-relaxed text-muted">بُني المشروع على نموذج SAFIRE الأولي لأحد أعضاء الفريق، ونموذج الذكاء الاصطناعي من إعداد عضو آخر في الفريق. استخدمنا Claude من Anthropic للتخطيط وClaude Code لكتابة الشيفرة، وتحمل الملفات المولّدة تعليقاً يوضح ذلك وفق قواعد التحدي.</p>
      </Panel>
    </div>
  )
}

export function AboutView() {
  const { lang } = useT()
  if (lang === 'ar') return <AboutAr />
  return (
    <div className="grid max-w-5xl gap-4 px-3 pt-2 sm:px-8 sm:pt-4">
      <Panel title="About Fire Guardian">
        <div className="grid gap-3 text-sm leading-relaxed text-muted">
          <p>Fire Guardian is our entry to the <b className="text-ink">NASA Space Apps Challenge 2026</b>, challenge <i>“Harmonization of MODIS and VIIRS Hot Spots”</i>. It turns two generations of NASA fire sensors into one consistent record for Saudi Arabia, then uses that record, with live satellite detections and weather, to detect fires, flag high-risk areas and plan a drone response.</p>
          <p className="rounded-lg border border-ember/30 bg-ember-soft p-3 text-ink/90">Fire Guardian is a research and demonstration tool. It is not an official warning system and does not replace the Saudi Civil Defense. The Drone demo page is a concept: the video is an animation and the fleet is a simulation; no hardware has been tested.</p>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Fire or factory?">
          <p className="text-[13px] text-muted">Most satellite hotspots in Saudi Arabia are factories, power plants and gas flares, not fires. Each live hotspot is classified from NASA’s own labels for that spot (NOAA-20/21), GIHS industrial areas, months-long persistence and a thermal-signature model, and the evidence is shown. Tested on months it never saw: 99.96% of industrial points and 72% of fires classified correctly. See Analytics → AI models.</p>
        </Panel>
        <Panel title="1 · Thermal space map">
          <ul className="grid gap-2 text-[13px] text-muted">
            <li><b className="text-red-400">Red</b>: active fires from NOAA-20/21 VIIRS (and optionally MODIS) via NASA FIRMS, with gas flares and industrial heat masked.</li>
            <li><b className="text-orange-300">Orange/yellow</b>: seasonal risk baseline, how often each 25 km cell burned in this calendar month over 2012–2025.</li>
            <li><b className="text-violet-300">Dashed cells (SW)</b>: the AI research index for tomorrow, coloured Low / Elevated / High.</li>
            <li><b className="text-emerald-300">Green</b>: cells with a fire history but low seasonal frequency.</li>
          </ul>
        </Panel>
        <Panel title="2 · Monitoring & prediction">
          <ul className="grid gap-2 text-[13px] text-muted">
            <li><b className="text-ink">AI Fire Prediction</b>: a teammate’s research model (logistic regression on NASA POWER weather) scores tomorrow for 29 cells in Jazan, Asir and Al Baha, as Low / Elevated / High with each level’s 2025 hit rate. It is roughly level with a seasonal baseline; see Analytics → AI model.</li>
            <li><b className="text-ink">Satellite thermal feed</b>: VIIRS shortwave-infrared imagery from NASA GIBS at each hotspot, with FIRMS pixel brightness temperature.</li>
            <li><b className="text-ink">Weather</b>: wind, humidity and temperature at the selected point from Meteomatics.</li>
          </ul>
        </Panel>
        <Panel title="3 · Drone response (concept)">
          <ul className="grid gap-2 text-[13px] text-muted">
            <li><b className="text-ink">A showcase, not a working system.</b> The Drone demo page shows how drones could work with Fire Guardian: a concept animation and a simulated fleet flown over today’s real fire detections. No drones exist yet.</li>
            <li>18 simulated drones at 12 regional bases. Squadron A attempts suppression on fires; Squadron B sprays preventive coolant on high-risk zones.</li>
            <li>Auto-response dispatches the nearest drones in range, sized by fire radiative power. You can also launch a squadron manually.</li>
            <li>Missions export as QGroundControl <code>.plan</code> files.</li>
          </ul>
        </Panel>
      </div>
      <Panel title="Data sources">
        <ul className="grid gap-1.5 text-sm text-muted">
          <li><b className="text-ink">NASA FIRMS</b>: MODIS C6.1 and VIIRS C2 archive and NRT (historical record), NOAA-20/21 VIIRS and MODIS NRT through the Area API (live).</li>
          <li><b className="text-ink">NASA GIBS</b>: Blue Marble relief, daily VIIRS true-colour and SWIR imagery.</li>
          <li><b className="text-ink">GIHS v3.0</b>: global industrial heat sources used in the flare mask (Ma et al. 2024, CC BY 4.0).</li>
          <li><b className="text-ink">NASA POWER</b>: daily weather inputs for the AI research model.</li>
          <li><b className="text-ink">Meteomatics</b>: point weather. <b className="text-ink">Natural Earth</b>: boundaries.</li>
        </ul>
      </Panel>
      <Panel title="Credits & AI tools used">
        <div className="grid gap-2 text-sm text-muted">
          <p>Built on <b className="text-ink">SAFIRE</b>, a teammate’s Streamlit prototype for Saudi fire early warning. We fixed its VIIRS confidence codes (l/n/h), replaced its bounding box with the real Saudi border, and switched to WebGL map rendering.</p>
          <p>We used Claude (Anthropic) for planning and Claude Code to write code. Generated source files carry a short AI-assistance header comment, as the Space Apps rules require. The team reviewed every data-processing decision.</p>
        </div>
      </Panel>
    </div>
  )
}
