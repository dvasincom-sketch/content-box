/**
 * Разовый сид: профили остальных участников BTS (шаблон 'profile').
 * Текст; портрет (обложка), галерею и видео добавляют в студии.
 *
 * Запуск: node --env-file=.env --import=tsx scripts/seed-bts-profiles.ts [subdomain]
 * Тенант: аргумент/ENV SEED_TENANT → домен *btsrussia* → первый.
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

type Profile = Record<string, unknown>
type Member = { slug: string; title: string; profile: Profile }

const MEMBERS: Member[] = [
  {
    slug: 'rm', title: 'RM',
    profile: {
      eyebrow: 'Лидер BTS · главный рэпер · автор',
      subtitle: 'Ким Намджун · 김남준 · бывш. Rap Monster',
      lead: 'Лидер BTS, главный рэпер, автор и продюсер. Известен интеллектом, знанием английского, любовью к книгам и современному искусству; лицо группы на мировых сценах, включая выступление в ООН.',
      quickFacts: [
        { label: 'Настоящее имя', value: 'Ким Намджун (김남준)' },
        { label: 'Дата рождения', value: '12 сентября 1994' },
        { label: 'Место', value: 'Сеул → Ильсан' },
        { label: 'Позиции', value: 'Лидер · гл. рэпер · автор' },
        { label: 'Дебют в BTS', value: '2013' },
        { label: 'Сольный дебют', value: 'RM (2015) · mono. (2018)' },
        { label: 'Фандом', value: 'ARMY' },
        { label: 'Ранее', value: 'Rap Monster' },
      ],
      sections: [
        { title: 'Роль в BTS', body: 'Намджун — лидер и голос группы: он ведёт переговоры, пишет и продюсирует, представляет BTS на международных площадках и держит команду вместе.\n\nОдин из самых плодовитых авторов K-pop; его тексты во многом задают смысловую глубину группы.' },
        { title: 'Характер', body: 'Вдумчивый, начитанный и рефлексирующий. Любит книги, современное искусство, природу и велопрогулки, с юмором относится к своей знаменитой «неуклюжести» и никогда не перестаёт учиться.' },
      ],
      timeline: [
        { year: '1994', title: 'Рождение в Сеуле', text: 'Детство в Ильсане; родители привили любовь к чтению и языкам.' },
        { year: 'Подростковые годы', title: 'Андеграунд-рэп', text: 'Пишет тексты, выступает под именем Rap Monster, самостоятельно учит английский.' },
        { year: '2013', title: 'Дебют лидером BTS', text: 'Возглавляет группу как главный рэпер и автор.' },
        { year: '2018', title: 'Микстейп «mono.»', text: 'Признан критиками; выступление на Генассамблее ООН.' },
        { year: '2022', title: 'Альбом «Indigo»', text: 'Зрелый сольный альбом о взрослении и искусстве.' },
        { year: '2024', title: '«Right Place, Wrong Person»', text: 'Экспериментальный сольный альбом.' },
        { year: '2025–2026', title: 'Служба и возвращение', text: 'Завершил службу в июне 2025; воссоединение BTS и альбом ARIRANG.' },
      ],
      relations: [
        { name: 'SUGA', text: 'Рэп-линия и авторский костяк группы; взаимное творческое доверие.' },
        { name: 'Jin', text: 'Старший товарищ и опора; тёплые, дружеские отношения.' },
        { name: 'Остальные', text: 'Как лидер держит атмосферу «семеро вместе» и помогает каждому.' },
      ],
      releases: [
        { title: 'RM', meta: 'Микстейп', year: '2015' },
        { title: 'mono.', meta: 'Плейлист', year: '2018' },
        { title: 'Indigo', meta: 'Альбом', year: '2022' },
        { title: 'Right Place, Wrong Person', meta: 'Альбом', year: '2024' },
        { title: 'Come back to me', meta: 'Сингл', year: '2024' },
      ],
      awards: [
        { title: 'Grammy', subtitle: 'Номинации в составе BTS', icon: '🎼' },
        { title: 'ООН', subtitle: 'Речь на Генассамблее', icon: '🕊️' },
        { title: 'Автор года', subtitle: 'Признание как автора K-pop', icon: '✍️' },
        { title: 'Billboard / MMA', subtitle: 'Множество наград с BTS', icon: '🏆' },
      ],
      facts: [
        'Самостоятельно выучил английский (во многом по сериалу «Друзья»)',
        'Лидер BTS с самого дебюта', 'Один из самых плодовитых авторов K-pop',
        'Один из самых читающих артистов сцены', 'Страстный поклонник современного искусства',
        'Любит природу и велопрогулки', 'С юмором относится к своей «неуклюжести»',
        'Представлял BTS в ООН', 'Ранее выступал под именем Rap Monster',
        'Микстейпы RM и mono.', 'Альбомы Indigo (2022) и Right Place, Wrong Person (2024)',
        'Высокий IQ и любовь к языкам', 'Никогда не перестаёт учиться',
      ],
    },
  },
  {
    slug: 'jin', title: 'Jin',
    profile: {
      eyebrow: 'Вокалист · самый старший · «Worldwide Handsome»',
      subtitle: 'Ким Сокджин · 김석진',
      lead: 'Вокалист и самый старший участник BTS. Известен тёплым тембром, чувством юмора и заботой о команде; первым ушёл на военную службу и первым вернулся.',
      quickFacts: [
        { label: 'Настоящее имя', value: 'Ким Сокджин (김석진)' },
        { label: 'Дата рождения', value: '4 декабря 1992' },
        { label: 'Место', value: 'Анян → Квачхон' },
        { label: 'Позиции', value: 'Вокалист · визуал' },
        { label: 'Дебют в BTS', value: '2013' },
        { label: 'Сольное', value: 'The Astronaut (2022) · Happy (2024)' },
        { label: 'Прозвище', value: 'Worldwide Handsome' },
        { label: 'Фандом', value: 'ARMY' },
      ],
      sections: [
        { title: 'Роль в BTS', body: 'Джин — эмоциональный старший группы: голос в балладах, визуал и человек, который снимает напряжение шуткой.\n\nЕго стабильность и забота во многом держат атмосферу команды.' },
        { title: 'Характер', body: 'Добрый, заботливый и лёгкий на юмор (знаменитые «папины шутки»). Любит рыбалку, кулинарию и игры, бережно относится к близким и поклонникам.' },
      ],
      timeline: [
        { year: '1992', title: 'Рождение в Аняне', text: 'Детство в Квачхоне; семья ценила образование.' },
        { year: 'Учёба', title: 'Путь в Big Hit', text: 'Замечен и приглашён на прослушивание; университетское образование в сфере искусств.' },
        { year: '2013', title: 'Дебют в BTS', text: 'Вокалист и самый старший участник.' },
        { year: '2022', title: '«The Astronaut»', text: 'Сольный сингл, написанный вместе с Coldplay.' },
        { year: 'дек 2022 – июнь 2024', title: 'Военная служба', text: 'Первым из BTS ушёл и первым вернулся.' },
        { year: '2024', title: 'Альбом «Happy»', text: 'Первый сольный альбом (Running Wild).' },
        { year: '2025–2026', title: 'Возвращение', text: 'Воссоединение BTS и новая глава группы.' },
      ],
      relations: [
        { name: 'RM', text: 'Тёплые отношения лидера и старшего товарища.' },
        { name: 'Jung Kook', text: 'Опекает младшего; близкая, почти братская связь.' },
        { name: 'Остальные', text: 'Старший, который заботится обо всех и снимает напряжение.' },
      ],
      releases: [
        { title: 'The Astronaut', meta: 'Сингл · с Coldplay', year: '2022' },
        { title: 'Happy', meta: 'Альбом', year: '2024' },
        { title: 'Running Wild', meta: 'Заглавный трек', year: '2024' },
        { title: 'Echo', meta: 'Мини-альбом', year: '2025' },
      ],
      awards: [
        { title: 'Grammy', subtitle: 'Номинации в составе BTS', icon: '🎼' },
        { title: 'The Astronaut', subtitle: 'Мировые чарты', icon: '🚀' },
        { title: 'Billboard / MMA', subtitle: 'Награды с BTS', icon: '🏆' },
      ],
      facts: [
        'Самый старший участник BTS', '«Worldwide Handsome»',
        'Первым ушёл и первым вернулся со службы', 'Любовь к рыбалке',
        'Любовь к кулинарии', 'Играет в MapleStory', 'Университетское образование',
        'Любовь к животным', 'Заботится о поклонниках', 'Мастер «папиных шуток»',
        'Сингл The Astronaut записан с Coldplay (2022)', 'Первый альбом Happy — 2024',
      ],
    },
  },
  {
    slug: 'suga', title: 'SUGA',
    profile: {
      eyebrow: 'Рэпер · продюсер · Agust D',
      subtitle: 'Мин Юнги · 민윤기 · Agust D',
      lead: 'Рэпер, автор и продюсер BTS, известный сольным альтер-эго Agust D. Пришёл из андеграунд-сцены Тэгу, мечтая быть продюсером; один из самых продуктивных авторов K-pop.',
      quickFacts: [
        { label: 'Настоящее имя', value: 'Мин Юнги (민윤기)' },
        { label: 'Дата рождения', value: '9 марта 1993' },
        { label: 'Место', value: 'Тэгу, Республика Корея' },
        { label: 'Позиции', value: 'Рэпер · автор · продюсер' },
        { label: 'Альтер-эго', value: 'Agust D' },
        { label: 'Дебют в BTS', value: '2013' },
        { label: 'Сольное', value: 'Agust D (2016) · D-DAY (2023)' },
        { label: 'Фандом', value: 'ARMY' },
      ],
      sections: [
        { title: 'Роль в BTS', body: 'Юнги — авторский и продюсерский костяк группы: он пишет и сводит треки, задаёт хип-хоп-основу звучания и часто стоит за кадром удачных релизов.\n\nВ сольном проекте Agust D он раскрывается предельно честно и жёстко.' },
        { title: 'Характер', body: 'Спокойный, прямой и работящий. Любит студию и ночную работу, редко повышает голос, ценит честные разговоры; за внешней сдержанностью — большая забота о команде.' },
      ],
      timeline: [
        { year: '1993', title: 'Рождение в Тэгу', text: 'Рано начинает писать музыку, выступает на андеграунд-сцене под именем Gloss.' },
        { year: 'До дебюта', title: 'Переезд в Сеул', text: 'Годы трудностей и тренировок ради мечты стать продюсером.' },
        { year: '2013', title: 'Дебют в BTS', text: 'Рэпер и один из главных авторов коллектива.' },
        { year: '2016', title: 'Микстейп «Agust D»', text: 'Жёсткое, откровенное сольное высказывание.' },
        { year: '2020', title: '«D-2»', text: 'Развитие сольной вселенной Agust D.' },
        { year: '2023', title: 'Альбом «D-DAY» и тур', text: 'Первый сольный мировой тур среди участников BTS.' },
        { year: '2023–2025', title: 'Служба и возвращение', text: 'Альтернативная служба; завершение в июне 2025 и воссоединение BTS.' },
      ],
      relations: [
        { name: 'RM', text: 'Авторско-продюсерский тандем и рэп-линия.' },
        { name: 'Jung Kook', text: 'Продюсировал для него трек Stay Alive; тёплое наставничество.' },
        { name: 'Остальные', text: 'Сдержанный, но надёжный старший, который заботится о команде.' },
      ],
      releases: [
        { title: 'Agust D', meta: 'Микстейп', year: '2016' },
        { title: 'D-2', meta: 'Микстейп', year: '2020' },
        { title: 'D-DAY', meta: 'Альбом', year: '2023' },
        { title: 'Daechwita', meta: 'Сингл', year: '2020' },
        { title: 'Haegeum', meta: 'Сингл', year: '2023' },
      ],
      awards: [
        { title: 'Grammy', subtitle: 'Номинации в составе BTS', icon: '🎼' },
        { title: 'Agust D TOUR', subtitle: '1-й сольный мировой тур среди BTS', icon: '🌍' },
        { title: 'Автор/продюсер', subtitle: 'Признание вне BTS', icon: '🎛️' },
        { title: 'Billboard / MMA', subtitle: 'Награды с BTS', icon: '🏆' },
      ],
      facts: [
        'Сольное альтер-эго — Agust D', 'До дебюта выступал под именем Gloss',
        'Всегда мечтал быть продюсером', 'Один из самых продуктивных авторов K-pop',
        'Перенёс операцию на плече', 'Любит работать ночью', 'Почти не расстаётся со студией',
        'Очень любит собак', 'Любит готовить', 'Практически не повышает голос',
        'Один из первых участников BTS', 'Первый сольный мировой тур среди BTS (D-DAY)',
        'Продюсировал треки для других артистов', 'Ценит честные разговоры',
      ],
    },
  },
  {
    slug: 'jimin', title: 'Jimin',
    profile: {
      eyebrow: 'Ведущий вокалист · ведущий танцор',
      subtitle: 'Пак Чимин · 박지민',
      lead: 'Ведущий вокалист и ведущий танцор BTS. Узнаваемый мягкий тембр и выразительная пластика, соединяющая современный танец, хип-хоп и театральную подачу.',
      quickFacts: [
        { label: 'Настоящее имя', value: 'Пак Чимин (박지민)' },
        { label: 'Дата рождения', value: '13 октября 1995' },
        { label: 'Место', value: 'Пусан, Республика Корея' },
        { label: 'Позиции', value: 'Ведущий вокал · ведущий танец' },
        { label: 'Дебют в BTS', value: '2013' },
        { label: 'Сольное', value: 'FACE (2023) · MUSE (2024)' },
        { label: 'Образование', value: 'Современный танец' },
        { label: 'Фандом', value: 'ARMY' },
      ],
      sections: [
        { title: 'Роль в BTS', body: 'Чимин — эмоциональный центр сцены: тонкий вокал в балладах и выразительный танец. Последним вошёл в финальный состав перед дебютом и стал одним из самых узнаваемых исполнителей группы.' },
        { title: 'Характер', body: 'Мягкий, чуткий и очень трудолюбивый. Перфекционист, много работает над собой и постепенно учится принимать себя; тёплый и близкий с участниками даже вне графиков.' },
      ],
      timeline: [
        { year: '1995', title: 'Рождение в Пусане', text: 'С детства увлекается танцем.' },
        { year: 'Школьные годы', title: 'Школа искусств', text: 'Профессионально изучает современный танец, переезжает в Сеул.' },
        { year: '2013', title: 'Дебют в BTS', text: 'Ведущий вокалист и ведущий танцор.' },
        { year: '2017', title: '«Serendipity»', text: 'Сольная баллада, одна из любимых у ARMY.' },
        { year: '2023', title: 'Альбом «FACE»', text: 'Like Crazy возглавил Billboard Hot 100.' },
        { year: '2024', title: 'Альбом «MUSE»', text: 'Заглавный трек Who — новый успех.' },
        { year: '2023–2025', title: 'Служба и возвращение', text: 'Служил вместе с Чонгуком; завершил службу 11 июня 2025.' },
      ],
      relations: [
        { name: 'Jung Kook', text: 'Близкая дружба; служили вместе, часто вместе и вне работы.' },
        { name: 'V', text: 'Одногодки и близкие друзья («95-line»).' },
        { name: 'Остальные', text: 'Тёплый и внимательный к каждому в команде.' },
      ],
      releases: [
        { title: 'Promise', meta: 'Сингл', year: '2018' },
        { title: 'FACE', meta: 'Альбом', year: '2023' },
        { title: 'Like Crazy', meta: '#1 Billboard Hot 100', year: '2023' },
        { title: 'MUSE', meta: 'Альбом', year: '2024' },
        { title: 'Who', meta: 'Сингл', year: '2024' },
      ],
      awards: [
        { title: 'Billboard Hot 100', subtitle: '«Like Crazy» — #1', icon: '📈' },
        { title: 'Grammy', subtitle: 'Номинации в составе BTS', icon: '🎼' },
        { title: 'Танцор года', subtitle: 'Признание пластики', icon: '💃' },
        { title: 'MMA / MAMA', subtitle: 'Награды с BTS', icon: '🏆' },
      ],
      facts: [
        'Последним вошёл в финальный состав BTS', 'Сначала сформировался как танцор',
        'Lie — одна из сложнейших вокальных партий BTS', 'Serendipity — любимая баллада ARMY',
        'Первый альбом FACE — 2023', 'Like Crazy возглавил Billboard Hot 100',
        'Второй альбом MUSE — 2024 (Who)', 'Ведущий вокалист и ведущий танцор',
        'Известен выразительной пластикой', 'Служил вместе с Чонгуком',
        'Завершил службу 11 июня 2025', 'Очень близок с участниками',
      ],
    },
  },
  {
    slug: 'v', title: 'V',
    profile: {
      eyebrow: 'Вокалист · баритон',
      subtitle: 'Ким Тэхён · 김태형 · V',
      lead: 'Вокалист BTS с редким для K-pop глубоким баритоном. Артистичный и стильный, увлечён джазом, фотографией и искусством; амбассадор мировых модных домов.',
      quickFacts: [
        { label: 'Настоящее имя', value: 'Ким Тэхён (김태형)' },
        { label: 'Дата рождения', value: '30 декабря 1995' },
        { label: 'Место', value: 'Тэгу → Кочхан' },
        { label: 'Позиции', value: 'Вокалист (баритон)' },
        { label: 'Дебют в BTS', value: '2013' },
        { label: 'Сольное', value: 'Layover (2023)' },
        { label: 'Амбассадор', value: 'CELINE · Cartier' },
        { label: 'Фандом', value: 'ARMY' },
      ],
      sections: [
        { title: 'Роль в BTS', body: 'Тэхён — узнаваемый баритон и артистичный визуал группы. Способен одинаково убедительно передавать нежность, драму и спокойствие, оставаясь непохожим на других исполнителей.' },
        { title: 'Характер', body: 'Свободный, творческий и немного богемный. Любит джаз, соул и классику, увлечён плёночной фотографией, живописью и искусством; тёплый и искренний с близкими.' },
      ],
      timeline: [
        { year: '1995', title: 'Рождение в Тэгу', text: 'Вырос в уезде Кочхан; несколько лет играл на саксофоне.' },
        { year: 'До дебюта', title: 'Неожиданное прослушивание', text: 'Попал в Big Hit почти случайно, сопровождая друга.' },
        { year: '2013', title: 'Дебют в BTS', text: 'Вокалист с редким баритоном.' },
        { year: '2019–2021', title: 'Winter Bear, Snow Flower', text: 'Авторские сольные песни, тёплый отклик у ARMY.' },
        { year: '2023', title: 'Альбом «Layover»', text: 'Джазово-соул сольный дебют (Slow Dancing, Rainy Days).' },
        { year: '2023–2025', title: 'Военная служба', text: 'Служил в спецподразделении SDT; завершил 10 июня 2025.' },
        { year: '2025–2026', title: 'Возвращение', text: 'Сингл FRI(END)S; участие в альбоме ARIRANG.' },
      ],
      relations: [
        { name: 'Jimin', text: 'Одногодки и близкие друзья («95-line»).' },
        { name: 'Jin', text: 'Записали вместе It’s Definitely You; тёплые отношения.' },
        { name: 'Остальные', text: 'Искренний и внимательный, объединяет теплом.' },
      ],
      releases: [
        { title: 'Winter Bear', meta: 'Сингл', year: '2019' },
        { title: 'Sweet Night', meta: 'OST', year: '2020' },
        { title: 'Christmas Tree', meta: 'OST', year: '2021' },
        { title: 'Layover', meta: 'Альбом', year: '2023' },
        { title: 'FRI(END)S', meta: 'Сингл', year: '2025' },
      ],
      awards: [
        { title: 'Grammy', subtitle: 'Номинации в составе BTS', icon: '🎼' },
        { title: 'CELINE · Cartier', subtitle: 'Глобальный амбассадор', icon: '👑' },
        { title: 'Layover', subtitle: 'Мировые чарты', icon: '📈' },
        { title: 'MMA / MAMA', subtitle: 'Награды с BTS', icon: '🏆' },
      ],
      facts: [
        'Родился в Тэгу, вырос в Кочхане', 'Несколько лет играл на саксофоне',
        'Редкий для K-pop естественный баритон', 'Любит джаз, соул, блюз и классику',
        'Увлекается плёночной фотографией', 'Интересуется живописью и искусством',
        'Автор Winter Bear, Scenery, Blue & Grey', 'Сольный альбом Layover — 2023',
        'Глобальный амбассадор CELINE и Cartier', 'Служил в спецподразделении SDT',
        'Завершил службу 10 июня 2025', 'Участвовал в альбоме ARIRANG (2026)',
      ],
    },
  },
  {
    slug: 'jungkook', title: 'Jung Kook',
    profile: {
      eyebrow: 'Главный вокалист · ведущий танцор · макнэ',
      subtitle: 'Чон Чонгук · 전정국 · Golden Maknae',
      lead: 'Главный вокалист и один из центральных танцоров BTS, самый младший участник. Дебютировал в 15 лет; за «золотым» прозвищем — человек, который никогда не переставал учиться.',
      quickFacts: [
        { label: 'Настоящее имя', value: 'Чон Чонгук (전정국)' },
        { label: 'Дата рождения', value: '1 сентября 1997' },
        { label: 'Место', value: 'Пусан, Республика Корея' },
        { label: 'Позиции', value: 'Гл. вокал · ведущий танец' },
        { label: 'Дебют в BTS', value: '2013 (в 15 лет)' },
        { label: 'Сольное', value: 'GOLDEN (2023)' },
        { label: 'Прозвище', value: 'Golden Maknae' },
        { label: 'Фандом', value: 'ARMY' },
      ],
      sections: [
        { title: 'Роль в BTS', body: 'Чонгук — вокальный и танцевальный центр группы, а также самый младший участник (макнэ). Миллионы поклонников наблюдали, как застенчивый подросток стал одним из самых узнаваемых артистов поп-музыки.' },
        { title: 'Характер', body: 'Скромный, трудолюбивый и разносторонний. Быстро осваивает новое, серьёзно занимается спортом и боксом, увлекается фотографией, монтажом и рисованием; сам снимал серию Golden Closet Films.' },
      ],
      timeline: [
        { year: '1997', title: 'Рождение в Пусане', text: 'Мечтает стать певцом; в 13 лет переезжает в Сеул.' },
        { year: 'До дебюта', title: 'Superstar K и Big Hit', text: 'Ездит в Лос-Анджелес учиться танцам.' },
        { year: '2013', title: 'Дебют в 15 лет', text: 'Самый молодой участник BTS — макнэ.' },
        { year: '2022', title: 'Dreamers', text: 'Выступление на церемонии ЧМ по футболу.' },
        { year: '2023', title: 'Seven и альбом «GOLDEN»', text: 'Seven (feat. Latto) возглавил Billboard Hot 100.' },
        { year: '2023–2025', title: 'Военная служба', text: 'Служил вместе с Чимином; завершил службу 11 июня 2025.' },
        { year: '2025–2026', title: 'Возвращение', text: 'Воссоединение BTS и новая глава группы.' },
      ],
      relations: [
        { name: 'Jimin', text: 'Близкая дружба; служили вместе.' },
        { name: 'Jin', text: 'Старший опекает младшего; тёплая, братская связь.' },
        { name: 'Остальные', text: 'Младший, которого группа вырастила и оберегает.' },
      ],
      releases: [
        { title: 'Still With You', meta: 'Сингл', year: '2020' },
        { title: 'Dreamers', meta: 'FIFA WC', year: '2022' },
        { title: 'Seven (feat. Latto)', meta: '#1 Billboard Hot 100', year: '2023' },
        { title: '3D (feat. Jack Harlow)', meta: 'Сингл', year: '2023' },
        { title: 'GOLDEN', meta: 'Альбом', year: '2023' },
      ],
      awards: [
        { title: 'Billboard Hot 100', subtitle: '«Seven» — #1', icon: '📈' },
        { title: 'Grammy', subtitle: 'Номинации в составе BTS', icon: '🎼' },
        { title: 'FIFA World Cup', subtitle: 'Выступление Dreamers (2022)', icon: '⚽' },
        { title: 'MMA / MAMA', subtitle: 'Награды с BTS', icon: '🏆' },
      ],
      facts: [
        'Самый молодой участник BTS (макнэ)', 'Прозвище Golden Maknae — «золотой младший»',
        'Дебютировал в 15 лет', 'Переехал из Пусана в Сеул в 13 лет',
        'Ездил в Лос-Анджелес учиться танцам', 'Сам снимал серию Golden Closet Films',
        'Увлекается фотографией, монтажом и рисованием', 'Серьёзно занимается спортом и боксом',
        'Seven (feat. Latto) возглавил Billboard Hot 100', 'Первый альбом GOLDEN — 2023',
        'Исполнял Dreamers на ЧМ-2022', 'Главный вокалист и один из центральных танцоров',
        'В ранних треках исполнял и рэп-партии', 'Никогда не переставал учиться',
      ],
    },
  },
]

const lex = (text: string) => ({
  root: { type: 'root', format: '', indent: 0, version: 1, direction: null as any,
    children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null as any,
      children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }] },
})

async function main() {
  const payload = await getPayload({ config: await (config as any) })
  const want = (process.argv[2] || process.env.SEED_TENANT || '').trim()
  const tenants = await payload.find({ collection: 'tenants', limit: 100, depth: 0, overrideAccess: true })
  let tenant: any = null
  if (want) tenant = (tenants.docs as any[]).find((t) => String(t.subdomain) === want || String(t.domain).includes(want))
  if (!tenant) tenant = (tenants.docs as any[]).find((t) => String(t.domain || '').includes('btsrussia'))
  if (!tenant) tenant = (tenants.docs as any[])[0]
  if (!tenant) { console.error('Тенант не найден'); process.exit(1) }
  console.log(`Тенант: ${tenant.name} (${tenant.subdomain}/${tenant.domain}) id=${tenant.id}`)
  const owner = (await payload.find({ collection: 'users', where: { tenant: { equals: tenant.id } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as any

  for (const m of MEMBERS) {
    const existing = await payload.find({ collection: 'publications', where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: m.slug } }] }, limit: 1, depth: 0, overrideAccess: true })
    const data: any = { title: m.title, slug: m.slug, tenant: tenant.id, template: 'profile', profile: m.profile, description: lex(String((m.profile as any).lead || m.title)), publishedAt: existing.docs[0]?.publishedAt || new Date().toISOString() }
    if (owner && !existing.docs.length) data.owner = owner.id
    if (existing.docs.length) { await payload.update({ collection: 'publications', id: (existing.docs[0] as any).id, data, overrideAccess: true }); console.log(`обновлён /publication/${m.slug}`) }
    else { const d = await payload.create({ collection: 'publications', data, overrideAccess: true }); console.log(`создан /publication/${m.slug} (id=${(d as any).id})`) }
  }
  console.log('Готово. Портреты (обложки), галереи и видео добавьте в студии.')
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
