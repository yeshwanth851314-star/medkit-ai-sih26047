export interface LandingTranslation {
  topBadge: string;
  langLabel: string;
  langChange: string;
  tourBtn: string;
  heroTitle: string;
  heroTagline: string;
  heroDesc: string;
  heroQuickPatient: string;
  heroQuickDoctor: string;
  heroQuickIntake: string;
  pathsHeaderTag: string;
  pathsTitle: string;
  pathsSubtitle: string;
  patientCard: {
    pathTag: string;
    title: string;
    idLabel: string;
    abhaLabel: string;
    features: string[];
    loginBtn: string;
    registerBtn: string;
    shareBtn: string;
  };
  doctorCard: {
    pathTag: string;
    title: string;
    idLabel: string;
    councilLabel: string;
    features: string[];
    loginBtn: string;
    registerBtn: string;
    shareBtn: string;
  };
  pharmacyCard: {
    pathTag: string;
    title: string;
    idLabel: string;
    licenseLabel: string;
    features: string[];
    loginBtn: string;
    registerBtn: string;
    shareBtn: string;
  };
  diagnosticCard: {
    pathTag: string;
    title: string;
    idLabel: string;
    nablLabel: string;
    features: string[];
    loginBtn: string;
    registerBtn: string;
    shareBtn: string;
  };
  disclaimerTitle: string;
  disclaimerText: string;
  pillars: {
    p1Title: string;
    p1Desc: string;
    p2Title: string;
    p2Desc: string;
    p3Title: string;
    p3Desc: string;
  };
}

export const LANDING_TRANSLATIONS: Record<string, LandingTranslation> = {
  en: {
    topBadge: "SIH26047 — Patient Case-Taking Software • Ministry of Ayush / AIIA",
    langLabel: "Language",
    langChange: "Change",
    tourBtn: "Start Guided Platform Tour",
    heroTitle: "MedKit AI",
    heroTagline: "Intelligent Multimodal Clinical Intake & Connected Hospital Continuum",
    heroDesc:
      "Unified healthcare portal connecting patients, physicians, pharmacies, and diagnostic laboratories with unique institutional IDs, shareable profiles, and zero-loss longitudinal timelines.",
    heroQuickPatient: "Patient Portal",
    heroQuickDoctor: "Doctor Workspace",
    heroQuickIntake: "New Clinical Intake",
    pathsHeaderTag: "Hospital Ecosystem Pathways",
    pathsTitle: "Select Your Healthcare Portal Pathway",
    pathsSubtitle:
      "Every participant possesses a verified unique identifier and shareable profile card. Choose Login or New Registration below.",
    patientCard: {
      pathTag: "Path 1 • Citizen & Outpatient",
      title: "Patient Portal",
      idLabel: "Unique Patient ID:",
      abhaLabel: "ABHA Linked",
      features: [
        "Longitudinal Medical History",
        "Diagnostic Lab Reports & Scans",
        "1-Time Prescriptions & QR Codes",
        "Consultation Appointment Booking",
      ],
      loginBtn: "Patient Login / Dashboard →",
      registerBtn: "New Registration / Onboarding",
      shareBtn: "Share Profile",
    },
    doctorCard: {
      pathTag: "Path 2 • Physician & Vaidya",
      title: "Doctor Portal",
      idLabel: "Unique Clinician ID:",
      councilLabel: "AIIA Senior",
      features: [
        "Doctor Availability Updater",
        "Waiting, Applied & Done OPDs",
        "Accept / Cancel Patient Queues",
        "Detailed AI Case Summary & Copilot",
      ],
      loginBtn: "Doctor Login / Dashboard →",
      registerBtn: "New Doctor Registration",
      shareBtn: "Share Profile",
    },
    pharmacyCard: {
      pathTag: "Path 3 • Dispensary & Stock",
      title: "Pharmacy Portal",
      idLabel: "Unique Pharmacist ID:",
      licenseLabel: "Reg. Dispensary",
      features: [
        "Uncompleted & New Prescriptions",
        "Old / Dispensed Prescription History",
        "Inventory Stock Quantity Updater",
        "Prescription QR Scanner & Dispensing",
      ],
      loginBtn: "Pharmacy Login / Queue →",
      registerBtn: "New Dispensary Registration",
      shareBtn: "Share Profile",
    },
    diagnosticCard: {
      pathTag: "Path 4 • Pathology & Scans",
      title: "Diagnostic Portal",
      idLabel: "Unique Technologist ID:",
      nablLabel: "NABL Lab",
      features: [
        "Laboratory Test Accessioning",
        "Diagnostic Scans & Imaging Viewer",
        "Formatted NABL Printable Reports",
        "Instant Doctor Notification Sync",
      ],
      loginBtn: "Diagnostic Login / Queue →",
      registerBtn: "New Lab Registration",
      shareBtn: "Share Profile",
    },
    disclaimerTitle: "Clinical Governance & Safety Boundary:",
    disclaimerText:
      "MedKit AI assists with clinical history acquisition, triage coordination, and documentation under Ministry of Ayush & AIIA guidelines. Final diagnosis and prescribing authority remains strictly with certified clinical practitioners.",
    pillars: {
      p1Title: "Multimodal Intake & 5 Indian Languages",
      p1Desc:
        "Voice-to-text with English, Hindi, Telugu, Tamil, and Kannada speech intake, dynamic question graph, and instant touch fallback.",
      p2Title: "Document OCR & Diagnostic Scans",
      p2Desc:
        "Digitize paper prescriptions, lab reports, and imaging scans with confidence scores, source references, and printable NABL reports.",
      p3Title: "Longitudinal Clinical Timeline",
      p3Desc:
        "Signature longitudinal view answering 'What changed since the last visit?' comparing current and past encounters cleanly.",
    },
  },

  hi: {
    topBadge: "SIH26047 — रोगी केस-टेकिंग सॉफ्टवेयर • आयुष मंत्रालय / AIIA",
    langLabel: "भाषा",
    langChange: "बदलें",
    tourBtn: "प्लेटफ़ॉर्म ऑनबोर्डिंग टूर शुरू करें",
    heroTitle: "MedKit AI",
    heroTagline: "बुद्धिमान मल्टीमॉडल क्लिनिकल इंटेक एवं अस्पताल निरंतरता",
    heroDesc:
      "मरीजों, डॉक्टरों, फार्मेसी और डायग्नोस्टिक लैब को यूनिक आईडी, साझा करने योग्य प्रोफाइल और डिजिटल टाइमलाइन से जोड़ने वाला एकीकृत स्वास्थ्य पोर्टल।",
    heroQuickPatient: "रोगी पोर्टल",
    heroQuickDoctor: "चिकित्सक पोर्टल",
    heroQuickIntake: "नया क्लिनिकल इंटेक",
    pathsHeaderTag: "अस्पताल इकोसिस्टम मार्ग",
    pathsTitle: "अपना स्वास्थ्य सेवा पोर्टल मार्ग चुनें",
    pathsSubtitle:
      "प्रत्येक उपयोगकर्ता के पास एक सत्यापित यूनिक पहचान और साझा करने योग्य प्रोफ़ाइल कार्ड है। नीचे लॉगिन या नया पंजीकरण चुनें।",
    patientCard: {
      pathTag: "मार्ग 1 • नागरिक एवं ओपीडी रोगी",
      title: "रोगी पोर्टल (Patient Portal)",
      idLabel: "यूनिक रोगी आईडी:",
      abhaLabel: "आयुष्मान भारत लिंक्ड",
      features: [
        "दीर्घकालिक चिकित्सा इतिहास (Medical History)",
        "डायग्नोस्टिक लैब रिपोर्ट एवं एक्स-रे स्कैन",
        "1-बार का प्रिस्क्रिप्शन एवं यूनिक क्यूआर कोड",
        "डॉक्टर परामर्श अप्वाइंटमेंट बुकिंग",
      ],
      loginBtn: "रोगी लॉगिन / डैशबोर्ड →",
      registerBtn: "नया पंजीकरण / ऑनबोर्डिंग",
      shareBtn: "प्रोफ़ाइल साझा करें",
    },
    doctorCard: {
      pathTag: "मार्ग 2 • चिकित्सक एवं वैद्य",
      title: "डॉक्टर पोर्टल (Doctor Portal)",
      idLabel: "यूनिक चिकित्सक आईडी:",
      councilLabel: "AIIA वरिष्ठ वैद्य",
      features: [
        "डॉक्टर उपलब्धता स्थिति अपडेटर",
        "प्रतीक्षारत, अनुप्रयुक्त एवं पूर्ण ओपीडी कतार",
        "रोगी स्वीकार/कॉल एवं रद्द करने की सुविधा",
        "विस्तृत एआई केस सारांश एवं सह-पायलट",
      ],
      loginBtn: "डॉक्टर लॉगिन / डैशबोर्ड →",
      registerBtn: "नया डॉक्टर पंजीकरण",
      shareBtn: "प्रोफ़ाइल साझा करें",
    },
    pharmacyCard: {
      pathTag: "मार्ग 3 • औषधालय एवं स्टॉक",
      title: "फार्मेसी पोर्टल (Pharmacy Portal)",
      idLabel: "यूनिक फार्मासिस्ट आईडी:",
      licenseLabel: "पंजीकृत औषधालय",
      features: [
        "अपूर्ण एवं नए नुस्खे (Prescriptions)",
        "वितरित नुस्खों का पुराना इतिहास",
        "दवा इन्वेंटरी स्टॉक संख्या अपडेटर",
        "क्यूआर स्कैन सत्यापन एवं वितरण",
      ],
      loginBtn: "फार्मेसी लॉगिन / कतार →",
      registerBtn: "नया औषधालय पंजीकरण",
      shareBtn: "प्रोफ़ाइल साझा करें",
    },
    diagnosticCard: {
      pathTag: "मार्ग 4 • पैथोलॉजी एवं इमेजिंग स्कैन",
      title: "डायग्नोस्टिक पोर्टल (Diagnostic Portal)",
      idLabel: "यूनिक टेक्नोलॉजिस्ट आईडी:",
      nablLabel: "NABL लैब",
      features: [
        "लैब टेस्ट सैंपल एक्सेशनिंग",
        "डायग्नोस्टिक स्कैन एवं एक्स-रे व्यूअर",
        "प्रमाणित NABL प्रिंट करने योग्य रिपोर्ट",
        "डॉक्टर के साथ त्वरित अधिसूचना समन्वय",
      ],
      loginBtn: "डायग्नोस्टिक लॉगिन / कतार →",
      registerBtn: "नया लैब पंजीकरण",
      shareBtn: "प्रोफ़ाइल साझा करें",
    },
    disclaimerTitle: "क्लिनिकल गवर्नेंस एवं सुरक्षा सीमा:",
    disclaimerText:
      "MedKit AI आयुष मंत्रालय और AIIA के दिशानिर्देशों के तहत क्लिनिकल इतिहास प्राप्त करने, प्राथमिकता तय करने और दस्तावेजीकरण में सहायता करता है। अंतिम निदान और नुस्खा लिखने का अधिकार केवल प्रमाणित चिकित्सकों के पास है।",
    pillars: {
      p1Title: "मल्टीमॉडल इंटेक एवं 5 भारतीय भाषाएँ",
      p1Desc:
        "अंग्रेजी, हिंदी, तेलुगु, तमिल और कन्नड़ में वॉयस-टू-टेक्स्ट, गतिशील प्रश्न ग्राफ और टच सहायता।",
      p2Title: "दस्तावेज़ ओसीआर एवं डायग्नोस्टिक स्कैन",
      p2Desc:
        "पुराने पर्चे, लैब रिपोर्ट और इमेजिंग स्कैन को डिजिटल बनाएं और प्रिंट करने योग्य NABL रिपोर्ट प्राप्त करें।",
      p3Title: "दीर्घकालिक क्लिनिकल टाइमलाइन",
      p3Desc:
        "पिछली मुलाकात की तुलना में 'क्या बदलाव हुआ?' का सटीक विश्लेषण प्रदान करने वाली अनूठी टाइमलाइन।",
    },
  },

  te: {
    topBadge: "SIH26047 — రోగి కేస్-టేకింగ్ సాఫ్ట్‌వేర్ • ఆయుష్ మంత్రిత్వ శాఖ / AIIA",
    langLabel: "భాష",
    langChange: "మార్చండి",
    tourBtn: "ప్లాట్‌ఫారమ్ గైడెడ్ టూర్ ప్రారంభించండి",
    heroTitle: "MedKit AI",
    heroTagline: "ఇంటెలిజెంట్ మల్టీమోడల్ క్లినికల్ ఇన్‌టేక్ & నిరంతర ఆసుపత్రి వ్యవస్థ",
    heroDesc:
      "రోగులు, వైద్యులు, ఫార్మసీలు మరియు డయాగ్నస్టిక్ ల్యాబ్‌లను ప్రత్యేక సంస్థాగత ఐడీలు, షేర్ చేయగల ప్రొఫైల్‌లతో అనుసంధానించే సమగ్ర ఆరోగ్య పోర్టల్.",
    heroQuickPatient: "రోగి పోర్టల్",
    heroQuickDoctor: "డాక్టర్ పోర్టల్",
    heroQuickIntake: "కొత్త క్లినికల్ ఇన్‌టేక్",
    pathsHeaderTag: "ఆసుపత్రి ఎకోసిస్టమ్ మార్గాలు",
    pathsTitle: "మీ ఆరోగ్య సంరక్షణ పోర్టల్ మార్గాన్ని ఎంచుకోండి",
    pathsSubtitle:
      "ప్రతి వినియోగదారుడికి ధృవీకరించబడిన ప్రత్యేక గుర్తింపు కార్డు ఉంది. క్రింద లాగిన్ లేదా కొత్త రిజిస్ట్రేషన్ ఎంచుకోండి.",
    patientCard: {
      pathTag: "మార్గం 1 • పౌరుడు & ఔట్ పేషెంట్",
      title: "రోగి పోర్టల్ (Patient Portal)",
      idLabel: "ప్రత్యేక రోగి ఐడీ:",
      abhaLabel: "ABHA అనుసంధానం",
      features: [
        "పూర్తి వైద్య చరిత్ర (Medical History)",
        "ల్యాబ్ పరీక్ష ఫలితాలు & ఎక్స్-రే స్కాన్లు",
        "1-సారి ప్రిస్క్రిప్షన్ & ప్రత్యేక క్యూఆర్ కోడ్",
        "డాక్టర్ సంప్రదింపుల అపాయింట్‌మెంట్ బుకింగ్",
      ],
      loginBtn: "రోగి లాగిన్ / డాష్‌బోర్డ్ →",
      registerBtn: "కొత్త రిజిస్ట్రేషన్ / ఆన్‌బోర్డింగ్",
      shareBtn: "ప్రొఫైల్ షేర్ చేయండి",
    },
    doctorCard: {
      pathTag: "మార్గం 2 • వైద్యులు & ఆయుర్వేద నిపుణులు",
      title: "డాక్టర్ పోర్టల్ (Doctor Portal)",
      idLabel: "ప్రత్యేక వైద్యుడి ఐడీ:",
      councilLabel: "AIIA సీనియర్",
      features: [
        "డాక్టర్ లభ్యత స్థితిని నవీకరించండి",
        "వేచి ఉన్న, దరఖాస్తు చేసిన & పూర్తయిన OPDలు",
        "రోగిని అంగీకరించడం/పిలవడం & రద్దు చేయడం",
        "వివరణాత్మక AI కేస్ సారాంశం & కోపైలట్",
      ],
      loginBtn: "డాక్టర్ లాగిన్ / డాష్‌బోర్డ్ →",
      registerBtn: "కొత్త డాక్టర్ రిజిస్ట్రేషన్",
      shareBtn: "ప్రొఫైల్ షేర్ చేయండి",
    },
    pharmacyCard: {
      pathTag: "మార్గం 3 • ఔషధశాల & స్టాక్",
      title: "ఫార్మసీ పోర్టల్ (Pharmacy Portal)",
      idLabel: "ప్రత్యేక ఫార్మసిస్ట్ ఐడీ:",
      licenseLabel: "లైసెన్స్డ్ డిస్పెన్సరీ",
      features: [
        "పూర్తికాని & కొత్త ప్రిస్క్రిప్షన్లు",
        "ఇచ్చిన మందుల పాత చరిత్ర",
        "ఇన్వెంటరీ స్టాక్ పరిమాణాన్ని మార్చండి",
        "క్యూఆర్ స్కాన్ ధృవీకరణ & పంపిణీ",
      ],
      loginBtn: "ఫార్మసీ లాగిన్ / క్యూ →",
      registerBtn: "కొత్త డిస్పెన్సరీ రిజిస్ట్రేషన్",
      shareBtn: "ప్రొఫైల్ షేర్ చేయండి",
    },
    diagnosticCard: {
      pathTag: "మార్గం 4 • పాథాలజీ & రేడియాలజీ స్కాన్లు",
      title: "డయాగ్నస్టిక్ పోర్టల్ (Diagnostic Portal)",
      idLabel: "ప్రత్యేక టెక్నాలజిస్ట్ ఐడీ:",
      nablLabel: "NABL ల్యాబ్",
      features: [
        "ల్యాబ్ పరీక్ష నమూనాల నమోదు",
        "డయాగ్నస్టిక్ స్కాన్లు & ఇమేజింగ్ వీక్షకం",
        "ప్రామాణిక NABL ప్రింట్ చేయగల నివేదికలు",
        "డాక్టర్‌కు తక్షణ నోటిఫికేషన్ సమకాలీకరణ",
      ],
      loginBtn: "డయాగ్నస్టిక్ లాగిన్ / క్యూ →",
      registerBtn: "కొత్త ల్యాబ్ రిజిస్ట్రేషన్",
      shareBtn: "ప్రొఫైల్ షేర్ చేయండి",
    },
    disclaimerTitle: "క్లినికల్ పాలన & భద్రతా పరిమితి:",
    disclaimerText:
      "ఆయుష్ మంత్రిత్వ శాఖ మరియు AIIA మార్గదర్శకాల ప్రకారం క్లినికల్ వివరాల సేకరణ మరియు డాక్యుమెంటేషన్‌లో MedKit AI సహాయపడుతుంది. తుది రోగ నిర్ధారణ మరియు మందులు రాయడం పూర్తిగా సర్టిఫైడ్ వైద్యుల పరిధిలోనే ఉంటుంది.",
    pillars: {
      p1Title: "మల్టీమోడల్ ఇన్‌టేక్ & 5 భారతీయ భాషలు",
      p1Desc:
        "ఇంగ్లీష్, హిందీ, తెలుగు, తమిళం మరియు కన్నడలో వాయిస్-టు-టెక్స్ట్ సంభాషణ, స్క్రీన్ టచ్ ఎంపికలు.",
      p2Title: "డాక్యుమెంట్ OCR & డయాగ్నస్టిక్ స్కాన్లు",
      p2Desc:
        "కాగితపు ప్రిస్క్రిప్షన్లు, ల్యాబ్ రిపోర్టులు మరియు స్కాన్లను డిజిటైజ్ చేయండి మరియు అధికారిక NABL రిపోర్టులను ముద్రించండి.",
      p3Title: "నిరంతర క్లినికల్ కాలక్రమం (Timeline)",
      p3Desc:
        "గత సందర్శనతో పోల్చి 'ఏమి మార్పు వచ్చింది?' అనే ముఖ్యమైన వివరాలను స్పష్టంగా అందించే ప్రత్యేక టైమ్‌లైన్.",
    },
  },

  ta: {
    topBadge: "SIH26047 — நோயாளி வழக்கு எடுக்கும் மென்பொருள் • ஆயுஷ் அமைச்சகம் / AIIA",
    langLabel: "மொழி",
    langChange: "மாற்று",
    tourBtn: "தள வழிகாட்டி சுற்றுப்பயணத்தைத் தொடங்கு",
    heroTitle: "MedKit AI",
    heroTagline: "நுண்ணறிவு பன்முக மருத்துவ சேர்க்கை & தொடர்ச்சியான மருத்துவமனை கட்டமைப்பு",
    heroDesc:
      "நோயாளிகள், மருத்துவர்கள், மருந்தகங்கள் மற்றும் கண்டறியும் ஆய்வகங்களை தனித்துவமான ஐடிகள், பகிரக்கூடிய சுயவிவரங்கள் மூலம் இணைக்கும் ஒருங்கிணைந்த சுகாதார போர்டல்.",
    heroQuickPatient: "நோயாளி போர்டல்",
    heroQuickDoctor: "மருத்துவர் போர்டல்",
    heroQuickIntake: "புதிய மருத்துவ சேர்க்கை",
    pathsHeaderTag: "மருத்துவமனை சுற்றுச்சூழல் பாதைகள்",
    pathsTitle: "உங்கள் சுகாதார போர்டல் பாதையைத் தேர்வுசெய்க",
    pathsSubtitle:
      "ஒவ்வொரு பங்கேற்பாளருக்கும் சரிபார்க்கப்பட்ட தனித்துவ அடையாள அட்டை உள்ளது. கீழே உள்நுழைவு அல்லது புதிய பதிவைத் தேர்ந்தெடுக்கவும்.",
    patientCard: {
      pathTag: "பாதை 1 • குடிமக்கள் & வெளிநோயாளி",
      title: "நோயாளி போர்டல் (Patient Portal)",
      idLabel: "தனித்துவ நோயாளி ஐடி:",
      abhaLabel: "ABHA இணைக்கப்பட்டது",
      features: [
        "நீண்டகால மருத்துவ வரலாறு (Medical History)",
        "ஆய்வக சோதனைகள் & எக்ஸ்-ரே ஸ்கேன்கள்",
        "1-முறை மருந்துச்சீட்டு & தனித்துவ க்யூஆர்",
        "மருத்துவர் ஆலோசனை அப்பாயிண்ட்மெண்ட் முன்பதிவு",
      ],
      loginBtn: "நோயாளி உள்நுழைவு / டாஷ்போர்டு →",
      registerBtn: "புதிய பதிவு / ஆன்போர்டிங்",
      shareBtn: "சுயவிவரத்தைப் பகிர்",
    },
    doctorCard: {
      pathTag: "பாதை 2 • மருத்துவர் & ஆயுஷ் நிபுணர்",
      title: "மருத்துவர் போர்டல் (Doctor Portal)",
      idLabel: "தனித்துவ மருத்துவர் ஐடி:",
      councilLabel: "AIIA மூத்த மருத்துவர்",
      features: [
        "மருத்துவர் கிடைக்கும் நிலை புதுப்பிப்பு",
        "காத்திருக்கும், விண்ணப்பித்த & முடிந்த OPDகள்",
        "நோயாளியை ஏற்றுக்கொள்/அழை & ரத்து செய்",
        "விரிவான AI வழக்கு சுருக்கம் & வழிகாட்டி",
      ],
      loginBtn: "மருத்துவர் உள்நுழைவு / டாஷ்போர்டு →",
      registerBtn: "புதிய மருத்துவர் பதிவு",
      shareBtn: "சுயவிவரத்தைப் பகிர்",
    },
    pharmacyCard: {
      pathTag: "பாதை 3 • மருந்தகம் & கையிருப்பு",
      title: "மருந்தக போர்டல் (Pharmacy Portal)",
      idLabel: "தனித்துவ மருந்தாளர் ஐடி:",
      licenseLabel: "அங்கீகரிக்கப்பட்ட மருந்தகம்",
      features: [
        "முடிக்கப்படாத & புதிய மருந்துச்சீட்டுகள்",
        "வழங்கப்பட்ட மருந்துகளின் பழைய வரலாறு",
        "சரக்கு கையிருப்பு அளவு புதுப்பிப்பாளர்",
        "க்யூஆர் ஸ்கேன் சரிபார்ப்பு & விநியோகம்",
      ],
      loginBtn: "மருந்தக உள்நுழைவு / வரிசை →",
      registerBtn: "புதிய மருந்தக பதிவு",
      shareBtn: "சுயவிவரத்தைப் பகிர்",
    },
    diagnosticCard: {
      pathTag: "பாதை 4 • நோயியல் & ஸ்கேன் மையம்",
      title: "கண்டறியும் போர்டல் (Diagnostic Portal)",
      idLabel: "தனித்துவ தொழில்நுட்ப வல்லுநர் ஐடி:",
      nablLabel: "NABL ஆய்வகம்",
      features: [
        "ஆய்வக மாதிரி பதிவு & சோதனை",
        "கண்டறியும் ஸ்கேன்கள் & எக்ஸ்-ரே பார்வையாளர்",
        "அங்கீகரிக்கப்பட்ட NABL அச்சிடக்கூடிய அறிக்கைகள்",
        "மருத்துவருடன் உடனடி அறிவிப்பு ஒத்திசைவு",
      ],
      loginBtn: "ஆய்வக உள்நுழைவு / வரிசை →",
      registerBtn: "புதிய ஆய்வக பதிவு",
      shareBtn: "சுயவிவரத்தைப் பகிர்",
    },
    disclaimerTitle: "மருத்துவ நிர்வாகம் & பாதுகாப்பு எல்லை:",
    disclaimerText:
      "ஆயுஷ் அமைச்சகம் மற்றும் AIIA வழிகாட்டுதல்களின் கீழ் தகவல்களைப் பெறுவதற்கும் ஆவணப்படுத்துவதற்கும் MedKit AI உதவுகிறது. இறுதி நோயறிதல் மற்றும் மருந்து பரிந்துரைக்கும் அதிகாரம் சான்றளிக்கப்பட்ட மருத்துவர்களுக்கு மட்டுமே உள்ளது.",
    pillars: {
      p1Title: "பன்முக சேர்க்கை & 5 இந்திய மொழிகள்",
      p1Desc:
        "ஆங்கிலம், இந்தி, தெலுங்கு, தமிழ் மற்றும் கன்னடத்தில் குரல்வழி தட்டச்சு மற்றும் தொடுதிரை வசதி.",
      p2Title: "ஆவண OCR & கண்டறியும் ஸ்கேன்கள்",
      p2Desc:
        "காகித மருந்துச்சீட்டுகள், ஆய்வக அறிக்கைகளை டிஜிட்டல் மயமாக்குங்கள் மற்றும் அச்சிடக்கூடிய NABL அறிக்கைகளைப் பெறுங்கள்.",
      p3Title: "நீண்டகால மருத்துவ காலவரிசை (Timeline)",
      p3Desc:
        "முந்தைய வருகையுடன் ஒப்பிட்டு 'என்ன மாற்றம் ஏற்பட்டுள்ளது?' என்பதை துல்லியமாக அறிய உதவும் தனித்துவ காலவரிசை.",
    },
  },

  kn: {
    topBadge: "SIH26047 — ರೋಗಿ ಕೇಸ್-ತೆಗೆದುಕೊಳ್ಳುವ ಸಾಫ್ಟ್‌ವೇರ್ • ಆಯುಷ್ ಸಚಿವಾಲಯ / AIIA",
    langLabel: "ಭಾಷೆ",
    langChange: "ಬದಲಾಯಿಸಿ",
    tourBtn: "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಆನ್‌ಬೋರ್ಡಿಂಗ್ ಟೂರ್ ಪ್ರಾರಂಭಿಸಿ",
    heroTitle: "MedKit AI",
    heroTagline: "ಬುದ್ಧಿವಂತ ಮಲ್ಟಿಮೋಡಲ್ ಕ್ಲಿನಿಕಲ್ ಇನ್‌ಟೇಕ್ & ಸಂಪರ್ಕಿತ ಆಸ್ಪತ್ರೆ ನಿರಂತರತೆ",
    heroDesc:
      "ರೋಗಿಗಳು, ವೈದ್ಯರು, ಔಷಧಾಲಯಗಳು ಮತ್ತು ರೋಗನಿರ್ಣಯ ಪ್ರಯೋಗಾಲಯಗಳನ್ನು ವಿಶಿಷ್ಟ ಗುರುತಿನ ಸಂಖ್ಯೆಗಳು ಮತ್ತು ಹಂಚಿಕೊಳ್ಳಬಹುದಾದ ಪ್ರೊಫೈಲ್‌ಗಳೊಂದಿಗೆ ಸಂಪರ್ಕಿಸುವ ಸಮಗ್ರ ಆರೋಗ್ಯ ಪೋರ್ಟಲ್.",
    heroQuickPatient: "ರೋಗಿ ಪೋರ್ಟಲ್",
    heroQuickDoctor: "ವೈದ್ಯರ ಪೋರ್ಟಲ್",
    heroQuickIntake: "ಹೊಸ ಕ್ಲಿನಿಕಲ್ ಇನ್‌ಟೇಕ್",
    pathsHeaderTag: "ಆಸ್ಪತ್ರೆ ಪರಿಸರ ವ್ಯವಸ್ಥೆಯ ಮಾರ್ಗಗಳು",
    pathsTitle: "ನಿಮ್ಮ ಆರೋಗ್ಯ ರಕ್ಷಣಾ ಪೋರ್ಟಲ್ ಮಾರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    pathsSubtitle:
      "ಪ್ರತಿಯೊಬ್ಬ ಭಾಗವಹಿಸುವವರು ಪರಿಶೀಲಿಸಿದ ವಿಶಿಷ್ಟ ಗುರುತಿನ ಚೀಟಿ ಹೊಂದಿದ್ದಾರೆ. ಕೆಳಗೆ ಲಾಗಿನ್ ಅಥವಾ ಹೊಸ ನೋಂದಣಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    patientCard: {
      pathTag: "ಮಾರ್ಗ 1 • ನಾಗರಿಕ & ಹೊರರೋಗಿ",
      title: "ರೋಗಿ ಪೋರ್ಟಲ್ (Patient Portal)",
      idLabel: "ವಿಶಿಷ್ಟ ರೋಗಿ ಐಡಿ:",
      abhaLabel: "ABHA ಲಿಂಕ್ ಮಾಡಲಾಗಿದೆ",
      features: [
        "ದೀರ್ಘಕಾಲೀನ ವೈದ್ಯಕೀಯ ಇತಿಹಾಸ (Medical History)",
        "ಪ್ರಯೋಗಾಲಯ ವರದಿಗಳು & ಕ್ಷ-ಕಿರಣ ಸ್ಕ್ಯಾನ್‌ಗಳು",
        "1-ಬಾರಿಯ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ & ವಿಶಿಷ್ಟ ಕ್ಯೂಆರ್ ಕೋಡ್",
        "ವೈದ್ಯರ ಸಮಾಲೋಚನೆ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕಿಂಗ್",
      ],
      loginBtn: "ರೋಗಿ ಲಾಗಿನ್ / ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ →",
      registerBtn: "ಹೊಸ ನೋಂದಣಿ / ಆನ್‌ಬೋರ್ಡಿಂಗ್",
      shareBtn: "ಪ್ರೊಫೈಲ್ ಹಂಚಿಕೊಳ್ಳಿ",
    },
    doctorCard: {
      pathTag: "ಮಾರ್ಗ 2 • ವೈದ್ಯರು & ವೈದ್ಯ ಶ್ರೇಷ್ಠರು",
      title: "ವೈದ್ಯರ ಪೋರ್ಟಲ್ (Doctor Portal)",
      idLabel: "ವಿಶಿಷ್ಟ ವೈದ್ಯರ ಐಡಿ:",
      councilLabel: "AIIA ಹಿರಿಯ ವೈದ್ಯ",
      features: [
        "ವೈದ್ಯರ ಲಭ್ಯತೆ ಸ್ಥಿತಿ ನವೀಕರಣ",
        "ಕಾಯುತ್ತಿರುವ, ಅನ್ವಯಿಸಲಾದ & ಪೂರ್ಣಗೊಂಡ OPDಗಳು",
        "ರೋಗಿಯನ್ನು ಸ್ವೀಕರಿಸಿ/ಕರೆಯಿರಿ & ರದ್ದುಗೊಳಿಸಿ",
        "ವಿವರವಾದ AI ಕೇಸ್ ಸಾರಾಂಶ & ಸಹ-ಪೈಲಟ್",
      ],
      loginBtn: "ವೈದ್ಯರ ಲಾಗಿನ್ / ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ →",
      registerBtn: "ಹೊಸ ವೈದ್ಯರ ನೋಂದಣಿ",
      shareBtn: "ಪ್ರೊಫೈಲ್ ಹಂಚಿಕೊಳ್ಳಿ",
    },
    pharmacyCard: {
      pathTag: "ಮಾರ್ಗ 3 • ಔಷಧಾಲಯ & ದಾಸ್ತಾನು",
      title: "ಔಷಧಾಲಯ ಪೋರ್ಟಲ್ (Pharmacy Portal)",
      idLabel: "ವಿಶಿಷ್ಟ ಔಷಧಿಕಾರರ ಐಡಿ:",
      licenseLabel: "ಪರವಾನಗಿ ಪಡೆದ ಔಷಧಾಲಯ",
      features: [
        "ಅಪೂರ್ಣ & ಹೊಸ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್‌ಗಳು",
        "ವಿತರಿಸಲಾದ ಔಷಧಿಗಳ ಹಳೆಯ ಇತಿಹಾಸ",
        "ದಾಸ್ತಾನು ಪ್ರಮಾಣ ನವೀಕರಣ ಸಾಧನ",
        "ಕ್ಯೂಆರ್ ಸ್ಕ್ಯಾನ್ ಪರಿಶೀಲನೆ & ವಿತರಣೆ",
      ],
      loginBtn: "ಔಷಧಾಲಯ ಲಾಗಿನ್ / ಸರದಿ →",
      registerBtn: "ಹೊಸ ಔಷಧಾಲಯ ನೋಂದಣಿ",
      shareBtn: "ಪ್ರೊಫೈಲ್ ಹಂಚಿಕೊಳ್ಳಿ",
    },
    diagnosticCard: {
      pathTag: "ಮಾರ್ಗ 4 • ರೋಗಶಾಸ್ತ್ರ & ಸ್ಕ್ಯಾನಿಂಗ್ ಕೇಂದ್ರ",
      title: "ಡಯಾಗ್ನೋಸ್ಟಿಕ್ ಪೋರ್ಟಲ್ (Diagnostic Portal)",
      idLabel: "ವಿಶಿಷ್ಟ ತಂತ್ರಜ್ಞರ ಐಡಿ:",
      nablLabel: "NABL ಲ್ಯಾಬ್",
      features: [
        "ಲ್ಯಾಬ್ ಪರೀಕ್ಷಾ ಮಾದರಿ ದಾಖಲಾತಿ",
        "ಡಯಾಗ್ನೋಸ್ಟಿಕ್ ಸ್ಕ್ಯಾನ್‌ಗಳು & ಇಮೇಜಿಂಗ್ ವೀಕ್ಷಕ",
        "ಪ್ರಮಾಣೀಕೃತ NABL ಮುದ್ರಿಸಬಹುದಾದ ವರದಿಗಳು",
        "ವೈದ್ಯರೊಂದಿಗೆ ತಕ್ಷಣದ ಅಧಿಸೂಚನೆ ಸಿಂಕ್",
      ],
      loginBtn: "ಡಯಾಗ್ನೋಸ್ಟಿಕ್ ಲಾಗಿನ್ / ಸರದಿ →",
      registerBtn: "ಹೊಸ ಲ್ಯಾಬ್ ನೋಂದಣಿ",
      shareBtn: "ಪ್ರೊಫೈಲ್ ಹಂಚಿಕೊಳ್ಳಿ",
    },
    disclaimerTitle: "ಕ್ಲಿನಿಕಲ್ ಆಡಳಿತ & ಸುರಕ್ಷತಾ ಗಡಿ:",
    disclaimerText:
      "ಆಯುಷ್ ಸಚಿವಾಲಯ ಮತ್ತು AIIA ಮಾರ್ಗಸೂಚಿಗಳ ಅಡಿಯಲ್ಲಿ ಕ್ಲಿನಿಕಲ್ ವಿವರಗಳ ಸಂಗ್ರಹಣೆ ಮತ್ತು ದಾಖಲಾತಿಗೆ MedKit AI ಸಹಾಯ ಮಾಡುತ್ತದೆ. ಅಂತಿಮ ರೋಗನಿರ್ಣಯ ಮತ್ತು ಔಷಧಿ ನೀಡುವ ಅಧಿಕಾರವು ಕೇವಲ ಪ್ರಮಾಣೀಕೃತ ವೈದ್ಯರ ಬಳಿ ಇರುತ್ತದೆ.",
    pillars: {
      p1Title: "ಮಲ್ಟಿಮೋಡಲ್ ಇನ್‌ಟೇಕ್ & 5 ಭಾರತೀಯ ಭಾಷೆಗಳು",
      p1Desc:
        "ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ, ತೆಲುಗು, ತಮಿಳು ಮತ್ತು ಕನ್ನಡದಲ್ಲಿ ಧ್ವನಿಯಿಂದ ಪಠ್ಯ ಪರಿವರ್ತನೆ ಮತ್ತು ಸ್ಪರ್ಶ ಪರದೆ ಆಯ್ಕೆಗಳು.",
      p2Title: "ದಾಖಲೆ OCR & ಡಯಾಗ್ನೋಸ್ಟಿಕ್ ಸ್ಕ್ಯಾನ್‌ಗಳು",
      p2Desc:
        "ಕಾಗದದ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್‌ಗಳು ಮತ್ತು ಲ್ಯಾಬ್ ವರದಿಗಳನ್ನು ಡಿಜಿಟಲ್ ಮಾಡಿ ಮತ್ತು ಮುದ್ರಿಸಬಹುದಾದ NABL ವರದಿಗಳನ್ನು ಪಡೆಯಿರಿ.",
      p3Title: "ದೀರ್ಘಕಾಲೀನ ಕ್ಲಿನಿಕಲ್ ಟೈಮ್‌ಲೈನ್",
      p3Desc:
        "ಹಿಂದಿನ ಭೇಟಿಗೆ ಹೋಲಿಸಿದರೆ 'ಏನು ಬದಲಾಗಿದೆ?' ಎಂಬ ಪ್ರಮುಖ ವಿವರಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ವಿವರಿಸುವ ವಿಶಿಷ್ಟ ಟೈಮ್‌ಲೈನ್.",
    },
  },
};
