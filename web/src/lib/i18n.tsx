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
  'legend.fire': 'Fire (classified from satellite data)',
  'legend.fire.big': 'Bigger icon = stronger fire',
  'legend.flare': 'Possible persistent or industrial heat',
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
  'live.filtered': 'Possible persistent heat sources: {n}',
  'live.showFiltered': 'Show possible persistent / industrial heat',
  'live.list': 'Fires', 'live.tap': 'Tap a fire on the map or in the list for details.',
  'fire.small': 'Small', 'fire.moderate': 'Moderate', 'fire.strong': 'Strong',
  'fire.ago.h': '{n} h ago', 'fire.ago.m': '{n} min ago', 'fire.ago.d': '{n} days ago',
  'fire.title': 'Selected fire', 'fire.points': 'Satellite detections: {n}',
  'fire.thermal': 'Satellite infrared view', 'fire.temp': 'Pixel brightness temperature {t}°C',
  'fire.thermal.note': 'NASA VIIRS image of the area; orange dots are the detections.',
  'fire.drone': 'Simulate drone response',
  'fire.unknownPlace': 'Saudi Arabia',

  'heat.title': 'Heat source assessment',
  'heat.volcano_candidate': 'NASA inferred an active volcano',
  'heat.offshore_detection': 'NASA inferred an offshore detection',
  'heat.industrial_map_candidate': 'On a historical industrial heat map',
  'heat.persistent_candidate': 'Possible repeated or static heat source',
  'heat.vegetation_candidate': 'Thermal pattern resembles vegetation fire',
  'heat.thermal_static_candidate': 'Thermal pattern resembles static heat',
  'heat.uncertain': 'Uncertain; needs verification',
  'heat.map': 'Detections on the industrial heat map: {n}',
  'heat.repeat': 'Detections with a persistence clue: {n}',
  'heat.pattern': 'Experimental model: vegetation-like {v} · static-like {s} · unclear {u} · unavailable {x}',
  'heat.transfer': 'Trained and tested on S-NPP: estimates on NOAA-20/21 are not yet validated.',
  'heat.note': 'Percentages estimate similarity to FIRMS inferred types 0 and 2, conditional on those two classes—not a verified fire probability. Nearby facilities are candidates, not proof of the source.',
  'heat.noData': 'The heat assessment is unavailable for this group.',
  'heat.point': 'Detection {n}',
  'heat.percent': 'Vegetation-fire-like: {v}% · Static-source-like: {s}%',
  'heat.nearby': 'Nearby listed facility: {name} ({km} km)',
  'heat.noneNearby': 'No listed facility within 5 km.',
  'heat.co': 'Regional modelled CO: {co} µg/m³ (CAMS / Open-Meteo)',
  'heat.noCo': 'CO data unavailable.',
  'heat.outside': 'Outside the 80 sampled training cells; estimates are less certain.',
  'heat.coNote': 'CO is a regional model, not a local sensor; CAMS can use satellite fire observations.',

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
  'dg.explain': 'Shown: fires burning now and places that burn in most years in {month}.',
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
  'an.tab.calendar': 'Fire calendar', 'an.tab.method': 'Harmonization & validation', 'an.tab.ai': 'AI models',
  'an.enOnly': 'The detailed charts below are in English.',

  'footer.motto': 'Monitoring a safer tomorrow', 'footer.powered': 'NASA FIRMS (NRT + labelled archive) · GIBS · POWER · GIHS · Climate TRACE · OpenStreetMap · Meteomatics',
  'common.loading': 'Loading…', 'common.close': 'Close', 'common.details': 'Details',
  'mode.sources': 'Heat sources',
  'mode.sources.hint': 'Factories, power plants, gas flares',
  'legend.unc': 'Hotspot we could not classify',
  'legend.src.factory': 'Factory or plant',
  'legend.src.power': 'Power plant',
  'legend.src.flare': 'Oil & gas / gas flare',
  'legend.src.offshore': 'Offshore platform',
  'legend.sites': 'Known industrial heat site (NASA)',
  'live.classified': 'Satellites saw {total} heat points: {f} fires · {i} industrial · {u} unclear',
  'live.unc': 'Unclear hotspots',
  'live.seeSources': 'See industrial heat',
  'why.title': 'Why we think so',
  'why.nasa_static': 'NASA labelled this spot an industrial heat source {n} times ({from} to {to}).',
  'why.nasa_offshore': 'NASA labels this spot an offshore source ({n} times).',
  'why.gihs': 'Inside a known industrial heat area (GIHS satellite inventory, 2012–2021).',
  'why.nasa_fire_history': 'NASA recorded {n} vegetation fires here and no industrial heat ({from} to {to}).',
  'why.thermal_fire': 'Its heat signature looks like a vegetation fire (industrial score {s}%).',
  'why.thermal_ind': 'Its heat signature looks like an industrial source (industrial score {s}%).',
  'why.persistent': 'Heat has been seen here again and again in 14 years of records.',
  'why.long_running': 'Heat was seen at this exact spot in {m} different months over two years. Vegetation fires do not burn that long; flares and plants do.',
  'why.live_repeat': 'Seen again on several night passes in the last days.',
  'why.none': 'Not enough evidence to decide either way.',
  'why.facility': 'Nearest named site: {name} · {type} · {km} km ({src}).',
  'why.noFacility': 'No named industrial site within 2 km.',
  'why.conf.high': 'Confidence: high',
  'why.conf.medium': 'Confidence: medium',
  'why.conf.low': 'Confidence: low',
  'why.tested': 'Tested on May–Jul 2026 against NASA labels: {f}% of fires and {i}% of industrial points classified correctly.',
  'type.power': 'Power plant',
  'type.cement': 'Cement plant',
  'type.steel': 'Steel plant',
  'type.refinery': 'Oil refinery',
  'type.petrochemical': 'Petrochemical plant',
  'type.aluminium': 'Aluminium smelter',
  'type.chemical': 'Chemical plant',
  'type.flare': 'Gas flare',
  'type.oil_gas': 'Oil & gas facility',
  'type.offshore': 'Offshore platform',
  'type.industrial': 'Industrial site',
  'type.unknown': 'Industrial heat (unnamed)',
  'src.count': 'Industrial heat points',
  'src.explain': 'Satellites also see heat from factories, power plants and gas flares. These are not wildfires. Here they are, classified.',
  'src.byType': 'By type',
  'src.list': 'Detected now',
  'src.known': 'Known industrial heat sites (grey circles): {n}',
  'src.site.title': 'Known industrial heat site',
  'src.site.n': 'NASA labelled {n} detections here as industrial heat between {from} and {to}; {night}% were at night.',
  'src.tap': 'Tap an icon to see what it is and why.',
  'src.unc.title': 'Unclear hotspot',
  'fc.month.this': 'This month',
  'fc.month.next': 'Next month',
  'fc.outlook.title': 'Fire outlook · {month}',
  'fc.outlook.text': 'From 14 years of NASA satellite records (2012–2025): the usual number of fire detections per province in this month. A seasonal pattern, not a forecast for a specific day.',
  'fc.outlook.typical': 'typical / month',
  'fc.outlook.up': 'peak season',
  'fc.outlook.down': 'quiet season',
  'fc.outlook.avg': 'average',
  'fc.exp.title': 'Experimental: tomorrow (research model)',
  'fc.exp.note': 'In tests this day-ahead model was no better than the monthly pattern, so it stays off the map unless you turn it on.',
  'fc.exp.show': 'Show its cells on the map',
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
  'legend.fire': 'حريق (مصنّف من بيانات الأقمار)',
  'legend.fire.big': 'الأيقونة الأكبر = حريق أقوى',
  'legend.flare': 'مصدر حراري متكرر أو صناعي محتمل',
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
  'live.filtered': 'مصادر حرارة متكررة محتملة: {n}',
  'live.showFiltered': 'إظهار الحرارة المتكررة أو الصناعية المحتملة',
  'live.list': 'الحرائق', 'live.tap': 'اضغط على حريق في الخريطة أو القائمة لعرض التفاصيل.',
  'fire.small': 'صغير', 'fire.moderate': 'متوسط', 'fire.strong': 'قوي',
  'fire.ago.h': 'قبل {n} ساعة', 'fire.ago.m': 'قبل {n} دقيقة', 'fire.ago.d': 'قبل {n} أيام',
  'fire.title': 'الحريق المحدد', 'fire.points': 'رصود الأقمار: {n}',
  'fire.thermal': 'صورة الأقمار بالأشعة تحت الحمراء', 'fire.temp': 'حرارة سطوع البكسل {t}°م',
  'fire.thermal.note': 'صورة من القمر VIIRS التابع لناسا؛ النقاط البرتقالية هي الرصود.',
  'fire.drone': 'محاكاة استجابة المسيّرات',
  'fire.unknownPlace': 'المملكة العربية السعودية',

  'heat.title': 'تحليل مصدر الحرارة',
  'heat.volcano_candidate': 'صنّفته ناسا بركاناً نشطاً محتملاً',
  'heat.offshore_detection': 'صنّفته ناسا رصداً بحرياً',
  'heat.industrial_map_candidate': 'ضمن خريطة تاريخية لمصادر حرارة صناعية',
  'heat.persistent_candidate': 'مصدر حرارة متكرر أو ثابت محتمل',
  'heat.vegetation_candidate': 'نمط حراري يشبه حريق الغطاء النباتي',
  'heat.thermal_static_candidate': 'نمط حراري يشبه مصدراً ثابتاً',
  'heat.uncertain': 'غير واضح؛ يحتاج إلى تحقق',
  'heat.map': 'رصود ضمن خريطة الحرارة الصناعية: {n}',
  'heat.repeat': 'رصود لها دليل تكرار حراري: {n}',
  'heat.pattern': 'النموذج التجريبي: يشبه النبات {v} · يشبه الثابت {s} · غير واضح {u} · غير متاح {x}',
  'heat.transfer': 'التدريب والاختبار كانا على S-NPP؛ نتائج NOAA-20/21 تجريبية ولم تُختبر بعد.',
  'heat.note': 'النسب تعبر عن تشابه الرصد مع نوعَي ناسا المستنتجَين 0 و2 فقط، وليست احتمال حريق مؤكد. المنشأة القريبة مرشحة وليست دليلاً على مصدر البؤرة.',
  'heat.noData': 'تحليل مصادر الحرارة غير متاح لهذه المجموعة.',
  'heat.point': 'الرصد {n}',
  'heat.percent': 'يشبه حريقاً نباتياً: {v}٪ · يشبه مصدراً ثابتاً: {s}٪',
  'heat.nearby': 'منشأة مسجلة قريبة: {name} (على بُعد {km} كم)',
  'heat.noneNearby': 'لا توجد منشأة في القائمة على بُعد ٥ كم.',
  'heat.co': 'تقدير الكربون الإقليمي: {co} ميكروغرام/م³ (CAMS / Open-Meteo)',
  'heat.noCo': 'بيانات أول أكسيد الكربون غير متاحة.',
  'heat.outside': 'خارج خلايا التدريب الثمانين؛ التقدير أقل ثقة.',
  'heat.coNote': 'الكربون تقدير إقليمي وليس حساساً بالموقع، وقد يستخدم CAMS رصود حرائق الأقمار.',

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
  'dg.explain': 'المعروض: الحرائق المشتعلة الآن، والأماكن التي تحترق في معظم السنوات في شهر {month}.',
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
  'an.tab.calendar': 'تقويم الحرائق', 'an.tab.method': 'الدمج والتحقق', 'an.tab.ai': 'نماذج الذكاء الاصطناعي',
  'an.enOnly': 'الرسوم البيانية التفصيلية أدناه باللغة الإنجليزية.',

  'footer.motto': 'نرصد من أجل غدٍ أكثر أماناً', 'footer.powered': 'ناسا FIRMS (مباشر + أرشيف مصنّف) · GIBS · POWER · GIHS · Climate TRACE · OpenStreetMap · Meteomatics',
  'common.loading': 'جارٍ التحميل…', 'common.close': 'إغلاق', 'common.details': 'التفاصيل',
  'mode.sources': 'مصادر الحرارة',
  'mode.sources.hint': 'مصانع ومحطات كهرباء وشعلات غاز',
  'legend.unc': 'نقطة حرارية لم نتمكن من تصنيفها',
  'legend.src.factory': 'مصنع أو منشأة',
  'legend.src.power': 'محطة كهرباء',
  'legend.src.flare': 'نفط وغاز / شعلة غاز',
  'legend.src.offshore': 'منصة بحرية',
  'legend.sites': 'موقع حرارة صناعي معروف (ناسا)',
  'live.classified': 'رصدت الأقمار {total} نقطة حرارية: حرائق {f} · صناعية {i} · غير محددة {u}',
  'live.unc': 'نقاط غير محددة',
  'live.seeSources': 'عرض الحرارة الصناعية',
  'why.title': 'لماذا نعتقد ذلك',
  'why.nasa_static': 'صنّفت ناسا هذا الموقع مصدر حرارة صناعياً {n} مرة (من {from} إلى {to}).',
  'why.nasa_offshore': 'تصنّف ناسا هذا الموقع مصدراً بحرياً ({n} مرة).',
  'why.gihs': 'داخل منطقة حرارة صناعية معروفة (قاعدة GIHS من الأقمار، 2012–2021).',
  'why.nasa_fire_history': 'سجّلت ناسا {n} حريقاً نباتياً هنا دون أي حرارة صناعية (من {from} إلى {to}).',
  'why.thermal_fire': 'بصمته الحرارية تشبه حريق غطاء نباتي (مؤشر الصناعي {s}%).',
  'why.thermal_ind': 'بصمته الحرارية تشبه مصدراً صناعياً (مؤشر الصناعي {s}%).',
  'why.persistent': 'تكرر رصد الحرارة هنا مراراً على مدى 14 عاماً من السجلات.',
  'why.long_running': 'رُصدت حرارة في هذه النقطة نفسها خلال {m} شهراً مختلفاً على مدى عامين. حرائق الغطاء النباتي لا تستمر هكذا، بخلاف الشعلات والمنشآت.',
  'why.live_repeat': 'رُصد مجدداً في عدة مرات مرور ليلية خلال الأيام الأخيرة.',
  'why.none': 'لا توجد أدلة كافية للحسم.',
  'why.facility': 'أقرب منشأة معروفة: {name} · {type} · {km} كم ({src}).',
  'why.noFacility': 'لا توجد منشأة صناعية معروفة ضمن 2 كم.',
  'why.conf.high': 'الثقة: عالية',
  'why.conf.medium': 'الثقة: متوسطة',
  'why.conf.low': 'الثقة: منخفضة',
  'why.tested': 'اختُبر على مايو–يوليو 2026 مقابل تصنيفات ناسا: صُنّف {f}% من الحرائق و{i}% من النقاط الصناعية بشكل صحيح.',
  'type.power': 'محطة كهرباء',
  'type.cement': 'مصنع إسمنت',
  'type.steel': 'مصنع حديد وصلب',
  'type.refinery': 'مصفاة نفط',
  'type.petrochemical': 'مصنع بتروكيماويات',
  'type.aluminium': 'مصهر ألمنيوم',
  'type.chemical': 'مصنع كيماويات',
  'type.flare': 'شعلة غاز',
  'type.oil_gas': 'منشأة نفط وغاز',
  'type.offshore': 'منصة بحرية',
  'type.industrial': 'موقع صناعي',
  'type.unknown': 'حرارة صناعية (غير مسماة)',
  'src.count': 'نقاط الحرارة الصناعية',
  'src.explain': 'ترصد الأقمار أيضاً حرارة المصانع ومحطات الكهرباء وشعلات الغاز، وهي ليست حرائق. هنا تجدها مصنّفة.',
  'src.byType': 'حسب النوع',
  'src.list': 'المرصودة الآن',
  'src.known': 'مواقع الحرارة الصناعية المعروفة (الدوائر الرمادية): {n}',
  'src.site.title': 'موقع حرارة صناعي معروف',
  'src.site.n': 'صنّفت ناسا {n} رصداً هنا كحرارة صناعية بين {from} و{to}؛ {night}% منها ليلاً.',
  'src.tap': 'اضغط على أي أيقونة لمعرفة ماهيتها وسبب تصنيفها.',
  'src.unc.title': 'نقطة حرارية غير محددة',
  'fc.month.this': 'هذا الشهر',
  'fc.month.next': 'الشهر القادم',
  'fc.outlook.title': 'توقعات الحرائق · {month}',
  'fc.outlook.text': 'من سجلات أقمار ناسا لـ14 عاماً (2012–2025): العدد المعتاد لرصود الحرائق في كل منطقة خلال هذا الشهر. نمط موسمي وليس توقعاً ليوم محدد.',
  'fc.outlook.typical': 'المعتاد شهرياً',
  'fc.outlook.up': 'ذروة الموسم',
  'fc.outlook.down': 'موسم هادئ',
  'fc.outlook.avg': 'متوسط',
  'fc.exp.title': 'تجريبي: الغد (نموذج بحثي)',
  'fc.exp.note': 'في الاختبارات لم يكن هذا النموذج أفضل من النمط الشهري، لذلك لا يظهر على الخريطة إلا إذا فعّلته.',
  'fc.exp.show': 'إظهار خلاياه على الخريطة',
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
