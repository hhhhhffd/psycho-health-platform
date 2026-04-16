"""
Скрипт наполнения БД демо-данными.
Создаёт 5 категорий тестов, вопросы (по 10 на возрастную группу),
5 курсов, 150 пользователей и ~200 результатов тестов.
Основан на реальных психологических тестах из tests.json.
"""
import asyncio
import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User, UserRole, AgeGroup
from app.models.test import TestCategory, TestQuestion, TestResult, ConditionLevel
from app.models.course import Course, CourseProgress, CourseStatus
from app.core.security import hash_password

fake_ru = Faker("ru_RU")
fake_en = Faker("en_US")

# ── Категории тестов (5 штук) ────────────────────────────────────────────────
CATEGORIES = [
    {
        "slug": "burnout",
        "name_ru": "Профессиональное выгорание",
        "name_kk": "Кәсіби күйіп қалу",
        "name_en": "Professional Burnout",
        "description_ru": "Тест жизнестойкости по методике С. Мадди. Оценивает вовлечённость, контроль и принятие риска.",
        "description_kk": "С. Мадди әдістемесі бойынша өмірлік төзімділік тесті. Тартылу, бақылау және тәуекелді қабылдауды бағалайды.",
        "description_en": "Hardiness test by S. Maddi. Evaluates involvement, control and risk acceptance.",
    },
    {
        "slug": "stress",
        "name_ru": "Уровень стресса",
        "name_kk": "Стресс деңгейі",
        "name_en": "Stress Level",
        "description_ru": "Оценка уровня стресса и психологической нагрузки. Выявляет факторы тревожности и напряжения.",
        "description_kk": "Стресс деңгейін және психологиялық жүктемені бағалау. Мазасыздық факторларын анықтайды.",
        "description_en": "Assessment of stress levels and psychological load. Identifies anxiety and tension factors.",
    },
    {
        "slug": "emotional",
        "name_ru": "Эмоциональное состояние",
        "name_kk": "Эмоционалдық жағдай",
        "name_en": "Emotional State",
        "description_ru": "Шкала благополучия. Оценивает общий эмоциональный фон, самооценку и удовлетворённость жизнью.",
        "description_kk": "Әл-ауқат шкаласы. Жалпы эмоционалдық фонды, өзін-өзі бағалауды және өмірге қанағаттануды бағалайды.",
        "description_en": "Well-being scale. Evaluates overall emotional state, self-esteem and life satisfaction.",
    },
    {
        "slug": "motivation",
        "name_ru": "Мотивация",
        "name_kk": "Мотивация",
        "name_en": "Motivation",
        "description_ru": "Оценка уровня мотивации, вовлечённости и внутренних ресурсов для достижения целей.",
        "description_kk": "Мотивация деңгейін, тартылуды және мақсатқа жету үшін ішкі ресурстарды бағалау.",
        "description_en": "Assessment of motivation levels, engagement and internal resources for goal achievement.",
    },
    {
        "slug": "anxiety",
        "name_ru": "Тревожность",
        "name_kk": "Мазасыздық",
        "name_en": "Anxiety",
        "description_ru": "Шкала безнадёжности Бека. Выявляет уровень тревожности, пессимизма и безнадёжности.",
        "description_kk": "Бек үмітсіздік шкаласы. Мазасыздық, пессимизм және үмітсіздік деңгейін анықтайды.",
        "description_en": "Beck Hopelessness Scale. Identifies anxiety, pessimism and hopelessness levels.",
    },
]

# ── Вопросы для каждой категории ──────────────────────────────────────────────
# 10 вопросов × 4 возрастные группы = 40 на категорию
# Варианты ответа по Likert: 0=Никогда, 1=Редко, 2=Иногда, 3=Часто, 4=Постоянно

QUESTIONS = {
    "burnout": {
        "adult": [
            ("Я чувствую себя опустошённым после рабочего дня", "Жұмыс күнінен кейін өзімді жүдеп қалған сезінемін", "I feel drained after a workday"),
            ("Мне трудно начинать новые проекты", "Жаңа жобаларды бастау маған қиын", "I find it hard to start new projects"),
            ("Я теряю интерес к своей работе", "Мен жұмысыма деген қызығушылығымды жоғалтып жатырмын", "I'm losing interest in my work"),
            ("Мне сложно сосредоточиться на задачах", "Маған тапсырмаларға шоғырлану қиын", "I find it hard to concentrate on tasks"),
            ("Я чувствую безразличие к коллегам", "Мен әріптестеріме бейтараптық сезінемін", "I feel indifferent towards colleagues"),
            ("У меня бывают головные боли от напряжения", "Маған шаршаудан бас ауруы болады", "I get headaches from tension"),
            ("Я не вижу смысла в своей деятельности", "Мен өз қызметімнің мәнін көрмеймін", "I don't see meaning in my activities"),
            ("Мне хочется изолироваться от окружающих", "Мен айналамдағылардан оқшаулануды қалаймын", "I want to isolate myself from others"),
            ("Я чувствую хроническую усталость", "Мен созылмалы шаршауды сезінемін", "I feel chronic fatigue"),
            ("Моя продуктивность значительно снизилась", "Менің өнімділігім айтарлықтай төмендеді", "My productivity has significantly decreased"),
        ],
        "high": [
            ("Мне не хочется идти на учёбу", "Маған оқуға барғым келмейді", "I don't feel like going to school"),
            ("Я чувствую усталость даже утром", "Мен таңертең де шаршауды сезінемін", "I feel tired even in the morning"),
            ("Учёба кажется мне бессмысленной", "Оқу маған мәнсіз болып көрінеді", "Studying seems meaningless to me"),
            ("Мне сложно выполнять домашние задания", "Маған үй тапсырмаларын орындау қиын", "I find it hard to do homework"),
            ("Я раздражаюсь на одноклассников", "Мен сыныптастарыма тітіркенемін", "I get irritated at classmates"),
            ("У меня болит голова после уроков", "Сабақтан кейін басым ауырады", "I get headaches after classes"),
            ("Я не хочу участвовать в школьных мероприятиях", "Мен мектеп іс-шараларына қатысқым келмейді", "I don't want to participate in school events"),
            ("Мне трудно запоминать новый материал", "Маған жаңа материалды есте сақтау қиын", "I find it hard to remember new material"),
            ("Я чувствую себя подавленным из-за учёбы", "Мен оқуға байланысты басылып жатырмын", "I feel depressed because of studies"),
            ("Мне кажется, что мои усилия напрасны", "Маған менің күш-жігерім бекер сияқты", "I feel like my efforts are in vain"),
        ],
        "middle": [
            ("Мне скучно на уроках", "Маған сабақтарда жалығарлық", "I get bored in class"),
            ("Я не хочу делать уроки", "Мен сабақтарды жасағым келмейді", "I don't want to do homework"),
            ("Я устаю в школе", "Мен мектепте шаршаймын", "I get tired at school"),
            ("Мне не интересно учиться", "Маған оқу қызық емес", "I'm not interested in studying"),
            ("Я злюсь на учителей", "Мен мұғалімдерге ашуланамын", "I get angry at teachers"),
            ("У меня нет сил после школы", "Мектептен кейін менде күш жоқ", "I have no energy after school"),
            ("Мне не хочется общаться с друзьями", "Маған достарыммен сөйлескім келмейді", "I don't feel like talking to friends"),
            ("Я часто забываю уроки", "Мен сабақтарды жиі ұмытамын", "I often forget about homework"),
            ("Мне грустно из-за школы", "Маған мектепке байланысты мұңдымын", "I feel sad about school"),
            ("Я думаю, что не справлюсь", "Мен шыға алмаймын деп ойлаймын", "I think I can't cope"),
        ],
        "elementary": [
            ("Мне не хочется идти в школу", "Маған мектепке барғым келмейді", "I don't want to go to school"),
            ("Я устаю на уроках", "Мен сабақтарда шаршаймын", "I get tired in class"),
            ("Мне скучно учиться", "Маған оқу жалықтырады", "I find studying boring"),
            ("Я не хочу делать домашку", "Мен үй жұмысын жасағым келмейді", "I don't want to do homework"),
            ("Мне грустно в школе", "Маған мектепте мұңды", "I feel sad at school"),
            ("У меня болит голова после уроков", "Сабақтан кейін басым ауырады", "My head hurts after class"),
            ("Я не хочу играть с друзьями", "Мен достарыммен ойнағым келмейді", "I don't want to play with friends"),
            ("Мне тяжело сидеть на уроке", "Маған сабақта отыру ауыр", "It's hard for me to sit in class"),
            ("Я плачу из-за школы", "Мен мектепке байланысты жылаймын", "I cry because of school"),
            ("Мне кажется, что всё плохо", "Маған бәрі жаман сияқты", "I feel like everything is bad"),
        ],
    },
    "stress": {
        "adult": [
            ("Я испытываю тревогу без видимой причины", "Мен көрінерлік себепсіз мазасыздық сезінемін", "I feel anxious for no apparent reason"),
            ("Мне сложно расслабиться после работы", "Маған жұмыстан кейін демалу қиын", "I find it hard to relax after work"),
            ("Я чувствую напряжение в теле", "Мен денемде шиеленісті сезінемін", "I feel tension in my body"),
            ("У меня проблемы со сном", "Менде ұйқы мәселесі бар", "I have sleep problems"),
            ("Я легко раздражаюсь", "Мен оңай тітіркенемін", "I get easily irritated"),
            ("Мне трудно принимать решения", "Маған шешім қабылдау қиын", "I find it hard to make decisions"),
            ("Я чувствую себя перегруженным", "Мен өзімді шамадан тыс жүктелген сезінемін", "I feel overwhelmed"),
            ("У меня учащённое сердцебиение от волнения", "Толқудан менің жүрегім жиі соғады", "My heart races from worry"),
            ("Я не могу перестать думать о проблемах", "Мен мәселелер туралы ойлауды тоқтата алмаймын", "I can't stop thinking about problems"),
            ("Стресс влияет на мои отношения", "Стресс менің қарым-қатынасыма әсер етеді", "Stress affects my relationships"),
        ],
        "high": [
            ("Я волнуюсь перед контрольными", "Мен бақылау жұмыстарының алдында толқимын", "I worry before tests"),
            ("Мне сложно уснуть из-за переживаний", "Маған уайымнан ұйықтау қиын", "I can't sleep due to worries"),
            ("Я чувствую давление от родителей", "Мен ата-анамнан қысым сезінемін", "I feel pressure from parents"),
            ("У меня напряжённые отношения с друзьями", "Менің достарыммен шиеленісті қарым-қатынасым бар", "I have tense relationships with friends"),
            ("Я часто нервничаю", "Мен жиі толқимын", "I often feel nervous"),
            ("Мне сложно сосредоточиться на учёбе", "Маған оқуға шоғырлану қиын", "I find it hard to focus on studies"),
            ("Я чувствую, что не успеваю", "Мен үлгере алмай жатырмын деп сезінемін", "I feel like I'm falling behind"),
            ("У меня бывают панические моменты", "Менде дүрбелең сәттері болады", "I have panic moments"),
            ("Я не могу расслабиться", "Мен демала алмаймын", "I can't relax"),
            ("Стресс мешает мне учиться", "Стресс маған оқуға кедергі жасайды", "Stress interferes with my studying"),
        ],
        "middle": [
            ("Я нервничаю перед уроками", "Мен сабақтардың алдында толқимын", "I get nervous before classes"),
            ("Мне страшно отвечать у доски", "Маған тақтада жауап беру қорқынышты", "I'm scared to answer at the board"),
            ("У меня болит живот от волнения", "Толқудан менің ішім ауырады", "My stomach hurts from worry"),
            ("Я боюсь плохих оценок", "Мен нашар бағалардан қорқамын", "I'm afraid of bad grades"),
            ("Мне трудно дружить", "Маған достасу қиын", "I find it hard to make friends"),
            ("Я переживаю, что обо мне думают", "Мен туралы не ойлайды деп мазаланамын", "I worry about what others think of me"),
            ("Я чувствую себя напряжённым", "Мен өзімді шиеленісті сезінемін", "I feel tense"),
            ("Мне снятся плохие сны", "Маған жаман түстер көрінеді", "I have bad dreams"),
            ("Я часто плачу", "Мен жиі жылаймын", "I cry often"),
            ("Мне хочется спрятаться", "Маған жасырынғым келеді", "I want to hide"),
        ],
        "elementary": [
            ("Мне страшно в школе", "Маған мектепте қорқынышты", "I feel scared at school"),
            ("У меня болит животик", "Менің ішім ауырады", "My tummy hurts"),
            ("Я боюсь учительницу", "Мен мұғалімнен қорқамын", "I'm afraid of my teacher"),
            ("Мне снятся страшные сны", "Маған қорқынышты түстер көрінеді", "I have scary dreams"),
            ("Я плачу перед школой", "Мен мектептің алдында жылаймын", "I cry before school"),
            ("Мне не нравится когда ругают", "Маған ұрысқанда ұнамайды", "I don't like being scolded"),
            ("Я волнуюсь когда мама уходит", "Мен анам кеткенде мазаланамын", "I worry when mom leaves"),
            ("Мне страшно отвечать", "Маған жауап беру қорқынышты", "I'm scared to answer"),
            ("Я боюсь темноты", "Мен қараңғыдан қорқамын", "I'm afraid of the dark"),
            ("Мне хочется к маме", "Маған анаға барғым келеді", "I want my mom"),
        ],
    },
    "emotional": {
        "adult": [
            ("Я чувствую себя счастливым", "Мен өзімді бақытты сезінемін", "I feel happy"),
            ("У меня хорошие отношения с близкими", "Менің жақындарыммен жақсы қарым-қатынасым бар", "I have good relationships with loved ones"),
            ("Я доволен своей жизнью", "Мен өмірімнен қанағаттанамын", "I'm satisfied with my life"),
            ("Я умею справляться с трудностями", "Мен қиындықтармен күресе аламын", "I can cope with difficulties"),
            ("У меня есть цели и планы", "Менің мақсаттарым мен жоспарларым бар", "I have goals and plans"),
            ("Я хорошо сплю", "Мен жақсы ұйықтаймын", "I sleep well"),
            ("Мне нравится моя работа", "Маған жұмысым ұнайды", "I like my job"),
            ("Я чувствую поддержку окружающих", "Мен айналамдағылардың қолдауын сезінемін", "I feel support from others"),
            ("Я испытываю положительные эмоции", "Мен жағымды эмоцияларды сезінемін", "I experience positive emotions"),
            ("Я уверен в себе", "Мен өзіме сенемін", "I'm confident in myself"),
        ],
        "high": [
            ("У меня хорошее настроение", "Менің көңіл-күйім жақсы", "I'm in a good mood"),
            ("Я легко нахожу общий язык с людьми", "Мен адамдармен оңай тіл табысамын", "I easily find common ground with people"),
            ("Мне нравится проводить время с друзьями", "Маған достарыммен уақыт өткізу ұнайды", "I like spending time with friends"),
            ("Я чувствую себя нужным", "Мен өзімді қажетті сезінемін", "I feel needed"),
            ("Я справляюсь со стрессом", "Мен стресспен күресе аламын", "I cope with stress"),
            ("У меня есть хобби", "Менде хобби бар", "I have hobbies"),
            ("Я горжусь своими достижениями", "Мен жетістіктеріммен мақтанамын", "I'm proud of my achievements"),
            ("Мне интересно жить", "Маған өмір сүру қызық", "I find life interesting"),
            ("Я принимаю себя таким, какой я есть", "Мен өзімді қандай болсам сондай қабылдаймын", "I accept myself as I am"),
            ("Я оптимистично смотрю в будущее", "Мен болашаққа оптимистік қараймын", "I look at the future optimistically"),
        ],
        "middle": [
            ("Мне весело с друзьями", "Маған достарыммен қызық", "I have fun with friends"),
            ("Я люблю учиться новому", "Мен жаңа нәрселерді оқуды жақсы көремін", "I love learning new things"),
            ("У меня есть лучший друг", "Менде ең жақсы досым бар", "I have a best friend"),
            ("Я радуюсь когда получаю хорошие оценки", "Мен жақсы баға алғанда қуанамын", "I'm happy when I get good grades"),
            ("Мне нравится мой класс", "Маған менің сыныбым ұнайды", "I like my class"),
            ("Я чувствую себя в безопасности", "Мен өзімді қауіпсіз сезінемін", "I feel safe"),
            ("Я умею радоваться мелочам", "Мен ұсақ нәрселерге қуана аламын", "I can enjoy small things"),
            ("У меня хорошие отношения с родителями", "Менің ата-анаммен жақсы қарым-қатынасым бар", "I have good relationships with parents"),
            ("Я не боюсь ошибаться", "Мен қателесуден қорқпаймын", "I'm not afraid of making mistakes"),
            ("Мне интересно в школе", "Маған мектепте қызық", "I find school interesting"),
        ],
        "elementary": [
            ("Я люблю играть", "Мен ойнауды жақсы көремін", "I love playing"),
            ("У меня есть друзья", "Менде достарым бар", "I have friends"),
            ("Мне нравится мой учитель", "Маған менің мұғалімім ұнайды", "I like my teacher"),
            ("Мне весело дома", "Маған үйде қызық", "I have fun at home"),
            ("Я люблю рисовать", "Мен сурет салуды жақсы көремін", "I love drawing"),
            ("Мне нравится школа", "Маған мектеп ұнайды", "I like school"),
            ("Я улыбаюсь каждый день", "Мен күн сайын күлімсіреймін", "I smile every day"),
            ("У меня хорошее настроение", "Менің көңіл-күйім жақсы", "I'm in a good mood"),
            ("Мне нравится гулять", "Маған серуендеу ұнайды", "I like going for walks"),
            ("Я люблю маму и папу", "Мен анам мен әкемді жақсы көремін", "I love mom and dad"),
        ],
    },
    "motivation": {
        "adult": [
            ("Я чётко знаю свои цели", "Мен мақсаттарымды анық білемін", "I clearly know my goals"),
            ("Я стремлюсь к профессиональному росту", "Мен кәсіби өсуге ұмтыламын", "I strive for professional growth"),
            ("Мне нравится то, чем я занимаюсь", "Маған мен айналысатын іс ұнайды", "I enjoy what I do"),
            ("Я готов прикладывать усилия для достижения целей", "Мен мақсаттарға жету үшін күш-жігер салуға дайынмын", "I'm ready to make efforts to achieve goals"),
            ("Я вижу перспективы в своей карьере", "Мен мансабымда болашақты көремін", "I see prospects in my career"),
            ("Я чувствую удовлетворение от своей работы", "Мен жұмысымнан қанағаттанамын", "I feel satisfaction from my work"),
            ("Я инициативен на работе", "Мен жұмыста бастамашылмын", "I'm proactive at work"),
            ("Мне важно развиваться", "Маған дамуы маңызды", "It's important for me to develop"),
            ("Я умею мотивировать себя", "Мен өзімді ынталандыра аламын", "I can motivate myself"),
            ("У меня есть внутренний драйв", "Менде ішкі қозғаушы күш бар", "I have an inner drive"),
        ],
        "high": [
            ("Я знаю, кем хочу стать", "Мен кім болғым келетінін білемін", "I know what I want to become"),
            ("Я стараюсь хорошо учиться", "Мен жақсы оқуға тырысамын", "I try to study well"),
            ("У меня есть мечта", "Менде арман бар", "I have a dream"),
            ("Я готов работать ради будущего", "Мен болашақ үшін жұмыс істеуге дайынмын", "I'm ready to work for my future"),
            ("Мне интересно узнавать новое", "Маған жаңа нәрселерді білу қызық", "I'm interested in learning new things"),
            ("Я не сдаюсь при трудностях", "Мен қиындықтарда берілмеймін", "I don't give up in difficulties"),
            ("Я планирую свой день", "Мен күнімді жоспарлаймын", "I plan my day"),
            ("Мне нравится достигать целей", "Маған мақсаттарға жету ұнайды", "I like achieving goals"),
            ("Я верю в свой успех", "Мен өз табысыма сенемін", "I believe in my success"),
            ("Я стремлюсь быть лучше", "Мен жақсырақ болуға ұмтыламын", "I strive to be better"),
        ],
        "middle": [
            ("Я хочу хорошо учиться", "Мен жақсы оқығым келеді", "I want to study well"),
            ("У меня есть любимый предмет", "Менде сүйікті пәнім бар", "I have a favorite subject"),
            ("Я стараюсь на уроках", "Мен сабақтарда тырысамын", "I try hard in class"),
            ("Мне нравится когда хвалят", "Маған мақтаған кезде ұнайды", "I like being praised"),
            ("Я хочу быть умным", "Мен ақылды болғым келеді", "I want to be smart"),
            ("Я делаю домашние задания", "Мен үй тапсырмаларын орындаймын", "I do my homework"),
            ("Мне интересно читать книги", "Маған кітап оқу қызық", "I find reading books interesting"),
            ("Я хочу быть похожим на своего кумира", "Мен өз ідолыма ұқсағым келеді", "I want to be like my idol"),
            ("Я горжусь своими успехами", "Мен жетістіктеріммен мақтанамын", "I'm proud of my achievements"),
            ("Я мечтаю о будущем", "Мен болашақ туралы армандаймын", "I dream about the future"),
        ],
        "elementary": [
            ("Мне нравится учиться", "Маған оқу ұнайды", "I like learning"),
            ("Я хочу получать пятёрки", "Мен бестіктер алғым келеді", "I want to get top grades"),
            ("Я стараюсь на уроках", "Мен сабақтарда тырысамын", "I try hard in class"),
            ("Мне нравится когда мама хвалит", "Маған анам мақтағанда ұнайды", "I like when mom praises me"),
            ("Я хочу быть умным", "Мен ақылды болғым келеді", "I want to be smart"),
            ("Мне интересно узнавать новое", "Маған жаңа нәрселерді білу қызық", "It's interesting to learn new things"),
            ("Я люблю отвечать на уроке", "Мен сабақта жауап беруді жақсы көремін", "I love answering in class"),
            ("Я хочу быть как мой герой", "Мен батырым сияқты болғым келеді", "I want to be like my hero"),
            ("Мне нравится решать задачки", "Маған есептер шешу ұнайды", "I like solving problems"),
            ("Я радуюсь хорошим оценкам", "Мен жақсы бағаларға қуанамын", "I'm happy with good grades"),
        ],
    },
    "anxiety": {
        "adult": [
            ("Я чувствую беспокойство о будущем", "Мен болашақ туралы мазасыздық сезінемін", "I feel worried about the future"),
            ("У меня бывают приступы паники", "Менде дүрбелең шабуылдары болады", "I have panic attacks"),
            ("Я боюсь потерять контроль", "Мен бақылауды жоғалтудан қорқамын", "I'm afraid of losing control"),
            ("Мне сложно находиться в толпе", "Маған адам көп жерде болу қиын", "I find it hard to be in crowds"),
            ("Я постоянно переживаю", "Мен үнемі уайымдаймын", "I constantly worry"),
            ("У меня есть навязчивые мысли", "Менде обсессивті ойлар бар", "I have obsessive thoughts"),
            ("Я избегаю новых ситуаций", "Мен жаңа жағдайлардан аулақ боламын", "I avoid new situations"),
            ("Мне сложно выступать публично", "Маған көпшілік алдында сөйлеу қиын", "I find it hard to speak publicly"),
            ("Я чувствую иррациональный страх", "Мен иррационалды қорқынышты сезінемін", "I feel irrational fear"),
            ("Тревога мешает мне жить нормально", "Мазасыздық маған қалыпты өмір сүруге кедергі жасайды", "Anxiety interferes with my normal life"),
        ],
        "high": [
            ("Я волнуюсь перед экзаменами", "Мен емтихандардың алдында толқимын", "I worry before exams"),
            ("Мне страшно выступать перед классом", "Маған сынып алдында сөйлеу қорқынышты", "I'm scared to speak in front of class"),
            ("Я боюсь что меня осудят", "Мен сыналатынымнан қорқамын", "I'm afraid of being judged"),
            ("У меня дрожат руки от волнения", "Толқудан менің қолдарым дірілдейді", "My hands shake from anxiety"),
            ("Я избегаю общения", "Мен қарым-қатынастан қашамын", "I avoid socializing"),
            ("Мне сложно принимать решения", "Маған шешім қабылдау қиын", "I find it hard to make decisions"),
            ("Я боюсь не оправдать ожиданий", "Мен үмітті ақтамаудан қорқамын", "I'm afraid of not meeting expectations"),
            ("У меня бессонница от тревоги", "Мазасыздықтан ұйықтай алмаймын", "I have insomnia from anxiety"),
            ("Я чувствую себя неуверенно", "Мен өзімді сенімсіз сезінемін", "I feel insecure"),
            ("Тревога мешает мне сосредоточиться", "Мазасыздық маған шоғырлануға кедергі жасайды", "Anxiety prevents me from concentrating"),
        ],
        "middle": [
            ("Я боюсь контрольных", "Мен бақылау жұмыстарынан қорқамын", "I'm afraid of tests"),
            ("Мне страшно ошибиться", "Маған қателесуден қорқынышты", "I'm scared of making mistakes"),
            ("Я волнуюсь когда вызывают к доске", "Мені тақтаға шақырғанда толқимын", "I worry when called to the board"),
            ("У меня колотится сердце от страха", "Қорқыныштан менің жүрегім дүрсілдейді", "My heart pounds from fear"),
            ("Я боюсь что друзья меня бросят", "Мен достарым мені тастайды деп қорқамын", "I'm afraid friends will abandon me"),
            ("Мне трудно заснуть", "Маған ұйықтау қиын", "I find it hard to fall asleep"),
            ("Я боюсь плохих новостей", "Мен жаман жаңалықтардан қорқамын", "I'm afraid of bad news"),
            ("Мне тревожно без причины", "Маған себепсіз мазасыз", "I feel anxious for no reason"),
            ("Я переживаю за семью", "Мен отбасым үшін алаңдаймын", "I worry about my family"),
            ("Мне хочется спрятаться от всех", "Маған бәрінен жасырынғым келеді", "I want to hide from everyone"),
        ],
        "elementary": [
            ("Мне страшно", "Маған қорқынышты", "I feel scared"),
            ("Я боюсь темноты", "Мен қараңғыдан қорқамын", "I'm afraid of the dark"),
            ("Мне снятся кошмары", "Маған қорқынышты түстер көрінеді", "I have nightmares"),
            ("Я боюсь что мама не придёт", "Мен анам келмейді деп қорқамын", "I'm afraid mom won't come"),
            ("Мне страшно одному", "Маған жалғыз қорқынышты", "I'm scared alone"),
            ("Я плачу когда боюсь", "Мен қорыққанда жылаймын", "I cry when I'm scared"),
            ("Мне тревожно в новых местах", "Маған жаңа жерлерде мазасыз", "I feel anxious in new places"),
            ("Я боюсь громких звуков", "Мен қатты дыбыстардан қорқамын", "I'm afraid of loud noises"),
            ("Мне не нравится быть одному", "Маған жалғыз болу ұнамайды", "I don't like being alone"),
            ("Я волнуюсь за маму", "Мен анам үшін алаңдаймын", "I worry about mom"),
        ],
    },
}

# ── Курсы (5 штук — по одному на категорию) ──────────────────────────────────
COURSES = [
    {
        "category_slug": "burnout",
        "title_ru": "Профилактика выгорания",
        "title_kk": "Күйіп қалудың алдын алу",
        "title_en": "Burnout Prevention",
        "description_ru": "Курс по распознаванию и предотвращению профессионального выгорания. Техники восстановления.",
        "description_kk": "Кәсіби күйіп қалуды тану және алдын алу курсы. Қалпына келтіру техникалары.",
        "description_en": "Course on recognizing and preventing professional burnout. Recovery techniques.",
        "video_urls": [
            "https://www.youtube.com/watch?v=wFCBFHBpJYQ",
            "https://www.youtube.com/watch?v=gRPBkCW0R5E",
        ],
        "content_ru": "## Что такое выгорание?\n\nПрофессиональное выгорание — это синдром, возникающий в результате хронического стресса на рабочем месте.\n\n### Признаки выгорания\n- Эмоциональное истощение\n- Деперсонализация\n- Снижение профессиональной эффективности\n\n### Техники восстановления\n1. Планирование отдыха\n2. Физическая активность\n3. Медитация и осознанность\n4. Социальная поддержка",
        "content_kk": "## Күйіп қалу дегеніміз не?\n\nКәсіби күйіп қалу — жұмыс орнындағы созылмалы стресс нәтижесінде пайда болатын синдром.",
        "content_en": "## What is Burnout?\n\nProfessional burnout is a syndrome resulting from chronic workplace stress.\n\n### Signs of Burnout\n- Emotional exhaustion\n- Depersonalization\n- Reduced professional efficacy",
    },
    {
        "category_slug": "stress",
        "title_ru": "Управление стрессом",
        "title_kk": "Стрессті басқару",
        "title_en": "Stress Management",
        "description_ru": "Практические методы снижения стресса и повышения стрессоустойчивости.",
        "description_kk": "Стрессті төмендетудің және стресске төзімділікті арттырудың практикалық әдістері.",
        "description_en": "Practical methods for reducing stress and increasing stress resilience.",
        "video_urls": [
            "https://www.youtube.com/watch?v=sG7DBA-mgFY",
            "https://www.youtube.com/watch?v=15GaKTP0gFE",
        ],
        "content_ru": "## Управление стрессом\n\n### Дыхательные техники\n1. Дыхание 4-7-8\n2. Диафрагмальное дыхание\n3. Попеременное дыхание\n\n### Физическая активность\nРегулярные упражнения снижают уровень кортизола.",
        "content_kk": "## Стрессті басқару\n\nТыныс алу техникалары мен физикалық белсенділік.",
        "content_en": "## Stress Management\n\n### Breathing Techniques\n1. 4-7-8 Breathing\n2. Diaphragmatic breathing",
    },
    {
        "category_slug": "emotional",
        "title_ru": "Эмоциональный интеллект",
        "title_kk": "Эмоционалдық интеллект",
        "title_en": "Emotional Intelligence",
        "description_ru": "Развитие эмоционального интеллекта и навыков эмоциональной регуляции.",
        "description_kk": "Эмоционалдық интеллектті және эмоционалдық реттеу дағдыларын дамыту.",
        "description_en": "Developing emotional intelligence and emotional regulation skills.",
        "video_urls": [
            "https://www.youtube.com/watch?v=n9h8fG1DKqk",
            "https://www.youtube.com/watch?v=LgUCyWhJf6s",
        ],
        "content_ru": "## Эмоциональный интеллект\n\n### Компоненты EQ\n1. Самосознание\n2. Саморегуляция\n3. Эмпатия\n4. Социальные навыки",
        "content_kk": "## Эмоционалдық интеллект\n\nEQ компоненттері: өзін-өзі тану, өзін-өзі реттеу, эмпатия.",
        "content_en": "## Emotional Intelligence\n\n### EQ Components\n1. Self-awareness\n2. Self-regulation\n3. Empathy\n4. Social skills",
    },
    {
        "category_slug": "motivation",
        "title_ru": "Повышение мотивации",
        "title_kk": "Мотивацияны арттыру",
        "title_en": "Boosting Motivation",
        "description_ru": "Курс по поиску внутренней мотивации и постановке эффективных целей.",
        "description_kk": "Ішкі мотивацияны табу және тиімді мақсаттар қою курсы.",
        "description_en": "Course on finding internal motivation and setting effective goals.",
        "video_urls": [
            "https://www.youtube.com/watch?v=u6XAPnuFjJc",
            "https://www.youtube.com/watch?v=3TX-Nu5wTS8",
        ],
        "content_ru": "## Мотивация\n\n### SMART-цели\n- Specific — конкретные\n- Measurable — измеримые\n- Achievable — достижимые\n- Relevant — актуальные\n- Time-bound — ограниченные по времени",
        "content_kk": "## Мотивация\n\nSMART-мақсаттар қою техникасы.",
        "content_en": "## Motivation\n\n### SMART Goals\n- Specific\n- Measurable\n- Achievable\n- Relevant\n- Time-bound",
    },
    {
        "category_slug": "anxiety",
        "title_ru": "Преодоление тревожности",
        "title_kk": "Мазасыздықты жеңу",
        "title_en": "Overcoming Anxiety",
        "description_ru": "Методы когнитивно-поведенческой терапии для снижения тревожности.",
        "description_kk": "Мазасыздықты азайту үшін когнитивті-мінез-құлықтық терапия әдістері.",
        "description_en": "Cognitive-behavioral therapy methods for reducing anxiety.",
        "video_urls": [
            "https://www.youtube.com/watch?v=WWloIAQpMcQ",
            "https://www.youtube.com/watch?v=MIc299Flibs",
        ],
        "content_ru": "## Преодоление тревожности\n\n### Техника 5-4-3-2-1\nЗаземление через органы чувств:\n- 5 вещей которые видишь\n- 4 вещи которые слышишь\n- 3 вещи которые ощущаешь\n- 2 запаха\n- 1 вкус",
        "content_kk": "## Мазасыздықты жеңу\n\n5-4-3-2-1 техникасы — сезім мүшелері арқылы жерге тұрақтау.",
        "content_en": "## Overcoming Anxiety\n\n### 5-4-3-2-1 Grounding Technique\n- 5 things you see\n- 4 things you hear\n- 3 things you touch\n- 2 things you smell\n- 1 thing you taste",
    },
]


async def seed_all(db: AsyncSession) -> None:
    """Главная функция наполнения БД — вызывается при старте или из CLI."""
    # Проверяем не засеяна ли уже БД
    existing = await db.execute(select(TestCategory))
    if existing.scalars().first():
        print("БД уже содержит данные — пропускаем сид")
        return

    print("🌱 Засеиваем БД демо-данными...")

    # 1. Создаём категории тестов
    categories: dict[str, TestCategory] = {}
    for idx, cat_data in enumerate(CATEGORIES):
        cat = TestCategory(**cat_data)
        db.add(cat)
        categories[cat_data["slug"]] = cat
    await db.flush()  # Чтобы получить ID

    print(f"  ✓ Создано {len(categories)} категорий тестов")

    # 2. Создаём вопросы
    question_count = 0
    for slug, age_groups in QUESTIONS.items():
        cat = categories[slug]
        for age_group_str, questions in age_groups.items():
            for order, (q_ru, q_kk, q_en) in enumerate(questions, 1):
                q = TestQuestion(
                    category_id=cat.id,
                    age_group=AgeGroup(age_group_str),
                    question_ru=q_ru,
                    question_kk=q_kk,
                    question_en=q_en,
                    order=order,
                )
                db.add(q)
                question_count += 1
    await db.flush()

    print(f"  ✓ Создано {question_count} вопросов")

    # 3. Создаём курсы
    courses: dict[str, Course] = {}
    for idx, course_data in enumerate(COURSES):
        data = {k: v for k, v in course_data.items() if k != "category_slug"}
        slug = course_data["category_slug"]
        cat = categories[slug]
        course = Course(
            category_id=cat.id,
            order=idx + 1,
            **data,
        )
        db.add(course)
        courses[slug] = course
    await db.flush()

    print(f"  ✓ Создано {len(courses)} курсов")

    # 4. Создаём демо-пользователей (150 штук)
    users: list[User] = []
    hashed_pw = hash_password("demo123")  # Один пароль для всех демо-аккаунтов

    # Специальные аккаунты — 2 админа, 3 психолога, 1 тестовый юзер
    special_users = [
        ("admin@demo.com", "Admin User", UserRole.admin, AgeGroup.adult),
        ("admin2@demo.com", "Администратор Сидоров", UserRole.admin, AgeGroup.adult),
        ("psych@demo.com", "Психолог Иванова", UserRole.psychologist, AgeGroup.adult),
        ("psych2@demo.com", "Психолог Петрова", UserRole.psychologist, AgeGroup.adult),
        ("psych3@demo.com", "Психолог Нұрланова", UserRole.psychologist, AgeGroup.adult),
        ("user@demo.com", "Тестовый Пользователь", UserRole.user, AgeGroup.adult),
    ]
    for email, name, role, age_group in special_users:
        u = User(
            email=email,
            hashed_password=hashed_pw,
            full_name=name,
            role=role,
            age_group=age_group,
            language="ru",
        )
        db.add(u)
        users.append(u)

    # Обычные пользователи
    age_groups = list(AgeGroup)
    for i in range(144):
        age_group = random.choice(age_groups)
        u = User(
            email=f"user{i+1}@demo.com",
            hashed_password=hashed_pw,
            full_name=fake_ru.name(),
            role=UserRole.user,
            age_group=age_group,
            language=random.choice(["ru", "ru", "ru", "kk", "en"]),  # 60% ru
        )
        db.add(u)
        users.append(u)
    await db.flush()

    print(f"  ✓ Создано {len(users)} пользователей")

    # 5. Генерируем результаты тестов (~200 штук за последние 3 месяца)
    now = datetime.now(timezone.utc)
    cat_list = list(categories.values())
    condition_levels = list(ConditionLevel)
    result_count = 0

    for _ in range(200):
        user = random.choice(users)
        cat = random.choice(cat_list)

        # Генерируем реалистичные ответы (10 вопросов, 0-4 каждый)
        # Распределение: больше людей с нормой, меньше с критическим
        bias = random.choices([0, 1, 2, 3], weights=[40, 30, 20, 10])[0]
        answers = [min(4, max(0, bias + random.randint(-1, 1))) for _ in range(10)]
        raw_score = sum(answers)
        max_score = 40

        pct = raw_score / max_score * 100
        if pct < 25:
            level = ConditionLevel.normal
        elif pct < 50:
            level = ConditionLevel.elevated_stress
        elif pct < 75:
            level = ConditionLevel.burnout_risk
        else:
            level = ConditionLevel.critical

        # Случайная дата за последние 3 месяца
        days_ago = random.randint(0, 90)
        created = now - timedelta(days=days_ago, hours=random.randint(0, 23))

        # Простой AI анализ (дефолтный — через AIService синглтон)
        from app.services.ai_service import get_ai_service
        from app.schemas.ai import AIAnalysisRequest
        ai_request = AIAnalysisRequest(
            category_slug=cat.slug,
            raw_score=raw_score,
            max_score=max_score,
            answers=answers,
            age_group=user.age_group.value if user.age_group else "adult",
            user_language=user.language or "ru",
        )
        ai_analysis = get_ai_service()._get_default_analysis(ai_request)

        tr = TestResult(
            user_id=user.id,
            category_id=cat.id,
            answers=answers,
            raw_score=raw_score,
            condition_level=level,
            ai_analysis=ai_analysis,
            created_at=created,
        )
        db.add(tr)
        result_count += 1

    await db.flush()
    print(f"  ✓ Создано {result_count} результатов тестов")

    # 6. Генерируем прогресс по курсам
    progress_count = 0
    course_list = list(courses.values())
    for user in random.sample(users, min(80, len(users))):
        course = random.choice(course_list)
        status = random.choice([CourseStatus.not_started, CourseStatus.in_progress, CourseStatus.completed])
        started = (now - timedelta(days=random.randint(0, 60))) if status != CourseStatus.not_started else None
        completed = (started + timedelta(days=random.randint(1, 14))) if status == CourseStatus.completed and started else None

        cp = CourseProgress(
            user_id=user.id,
            course_id=course.id,
            status=status,
            started_at=started,
            completed_at=completed,
        )
        db.add(cp)
        progress_count += 1

    await db.commit()
    print(f"  ✓ Создано {progress_count} записей прогресса")
    print("✅ Сид завершён!")


async def run_seed() -> None:
    """Точка входа для запуска сида."""
    async with AsyncSessionLocal() as db:
        await seed_all(db)


if __name__ == "__main__":
    asyncio.run(run_seed())
