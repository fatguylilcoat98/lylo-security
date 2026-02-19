import { PersonaConfig } from '../data/personas';

interface ContextPattern {
  id: string;
  weight: number;
  clusters: string[][];
}

export const EXPERT_CONTEXTS: ContextPattern[] = [
  {
    id: 'lawyer',
    weight: 2.8, 
    clusters: [
      // Tenant & Real Estate
      ['evicted', 'notice', 'lease', 'landlord', 'tenant', 'rent', 'housing', 'occupancy', 'habitable', 'deposit', 'sublet', 'squatter', 'premises', 'zoning', 'easement', 'escrow', 'foreclosure', 'deed', 'title', 'lien'],
      ['repair', 'withhold', 'deduct', 'habitability', 'infestation', 'mold', 'plumbing', 'heating', 'ordinance', 'code', 'violation', 'inspector', 'retaliation'],
      // Civil Litigation
      ['sue', 'sued', 'lawsuit', 'litigation', 'damages', 'court', 'summons', 'complaint', 'judge', 'plaintiff', 'defendant', 'jury', 'testify', 'subpoena', 'deposition', 'affidavit', 'jurisdiction', 'venue', 'appeal', 'verdict'],
      ['settlement', 'mediation', 'arbitration', 'negotiation', 'discovery', 'interrogatory', 'pleading', 'motion', 'injunction', 'restraining'],
      // Corporate & Contracts
      ['contract', 'agreement', 'clause', 'terms', 'binding', 'signed', 'notary', 'breach', 'nda', 'incorporation', 'llc', 'bylaws', 'shareholder', 'merger', 'acquisition', 'partnership', 'liability', 'indemnity', 'void', 'null'],
      ['vendor', 'supplier', 'procurement', 'invoice', 'payment', 'dispute', 'fulfillment', 'warranty', 'guarantee', 'default'],
      // Criminal Defense
      ['arrest', 'police', 'miranda', 'rights', 'detained', 'warrant', 'bail', 'custody', 'charge', 'felony', 'misdemeanor', 'parole', 'probation', 'indictment', 'plea', 'prosecutor', 'defense', 'conviction', 'acquittal', 'sentence'],
      ['search', 'seizure', 'probable', 'cause', 'interrogation', 'suspect', 'evidence', 'confession', 'alibi', 'accomplice', 'accessory'],
      // Employment Law
      ['employment', 'fired', 'wrongful', 'severance', 'discrimination', 'harassment', 'unpaid', 'overtime', 'whistleblower', 'retaliation', 'union', 'strike', 'osha', 'workers comp', 'fmla', 'ada', 'wage', 'hour', 'classification', 'exempt'],
      ['non-compete', 'solicitation', 'trade', 'secret', 'resignation', 'constructive', 'discharge', 'hostile', 'environment'],
      // Family Law
      ['divorce', 'custody', 'alimony', 'support', 'prenup', 'separation', 'family', 'probate', 'estate', 'will', 'trust', 'inheritance', 'guardian', 'adoption', 'emancipation', 'paternity', 'visitation', 'annulment', 'assets', 'marital'],
      // Personal Injury
      ['injury', 'accident', 'liability', 'insurance', 'claim', 'negligence', 'malpractice', 'tort', 'settlement', 'compensation', 'crash', 'slip', 'fall', 'whiplash', 'concussion', 'fault', 'premium', 'adjuster', 'policy'],
      // IP & Copyright
      ['copyright', 'trademark', 'patent', 'infringement', 'intellectual', 'property', 'licensing', 'royalties', 'plagiarism', 'piracy', 'trade', 'secret', 'cease', 'desist', 'fair', 'use', 'author', 'creator', 'domain'],
      // Traffic & Citations
      ['ticket', 'citation', 'dui', 'reckless', 'impound', 'suspended', 'license', 'dmv', 'speeding', 'moving', 'violation', 'points', 'registration', 'insurance', 'breathalyzer'],
      // Immigration
      ['visa', 'passport', 'citizenship', 'green', 'card', 'deportation', 'asylum', 'immigration', 'customs', 'border', 'sponsor', 'h1b', 'f1', 'naturalization']
    ]
  },
  {
    id: 'doctor',
    weight: 2.8,
    clusters: [
      // Cardiovascular
      ['chest', 'pain', 'heart', 'pressure', 'tightness', 'palpitations', 'arrhythmia', 'tachycardia', 'bradycardia', 'pulse', 'bp', 'hypertension', 'stroke', 'attack', 'valve', 'artery', 'vein', 'circulation', 'clot'],
      // Respiratory
      ['breathing', 'shortness', 'asthma', 'wheezing', 'lung', 'cough', 'phlegm', 'mucus', 'pneumonia', 'bronchitis', 'inhaler', 'oxygen', 'cpap', 'apnea', 'choking'],
      // Gastrointestinal
      ['stomach', 'ulcer', 'bowel', 'digestion', 'acid', 'reflux', 'cramps', 'nausea', 'vomiting', 'diarrhea', 'constipation', 'bloating', 'gas', 'appendix', 'liver', 'kidney', 'gallbladder', 'hernia'],
      // Dermatological
      ['rash', 'swelling', 'allergic', 'hives', 'anaphylaxis', 'sting', 'reaction', 'itching', 'lesion', 'melanoma', 'eczema', 'dermatitis', 'burn', 'blister', 'acne', 'psoriasis', 'cyst', 'wart', 'mole'],
      // Trauma / Hemorrhage
      ['blood', 'bleeding', 'wound', 'cut', 'laceration', 'hemorrhage', 'bruising', 'tourniquet', 'stitch', 'suture', 'puncture', 'trauma', 'scab', 'scar', 'gauze', 'bandage'],
      // Neurological
      ['dizzy', 'faint', 'unconscious', 'seizure', 'numbness', 'slurred', 'vision', 'migraine', 'concussion', 'vertigo', 'tingling', 'paralysis', 'tremor', 'memory', 'nerve', 'sciatica', 'neuropathy'],
      // Pharmacology
      ['medicine', 'prescription', 'dosage', 'antibiotic', 'side-effect', 'interaction', 'pill', 'pharmacy', 'refill', 'overdose', 'toxicity', 'mg', 'vaccine', 'injection', 'iv', 'drip', 'steroid', 'painkiller', 'nsaid'],
      // Infection & Systemic
      ['fever', 'chills', 'dehydration', 'flu', 'symptoms', 'infection', 'pus', 'inflamed', 'throbbing', 'tender', 'redness', 'warmth', 'abscess', 'bacteria', 'viral', 'fungal', 'sepsis', 'lymph', 'node', 'swollen', 'gland'],
      // Orthopedic
      ['bone', 'fracture', 'sprain', 'joint', 'arthritis', 'cartilage', 'ligament', 'tendon', 'spine', 'vertebrae', 'scoliosis', 'cast', 'splint', 'brace', 'crutches', 'knee', 'shoulder', 'hip', 'ankle'],
      // ENT (Ear, Nose, Throat)
      ['ear', 'throat', 'sinus', 'congestion', 'hearing', 'tinnitus', 'strep', 'tonsil', 'nosebleed', 'swallow', 'vocal', 'cords', 'mucus', 'drainage'],
      // Optical
      ['eye', 'vision', 'blur', 'cornea', 'retina', 'pupil', 'cataract', 'glaucoma', 'astigmatism', 'glasses', 'contacts', 'dilation', 'blindness'],
      // Urological / Reproductive
      ['urine', 'bladder', 'uti', 'kidney', 'stones', 'prostate', 'pelvic', 'menstrual', 'cramps', 'pregnancy', 'fertility', 'hormone', 'testosterone', 'estrogen']
    ]
  },
  {
    id: 'wealth',
    weight: 2.2,
    clusters: [
      // Banking & Transactions
      ['bank', 'account', 'unauthorized', 'transfer', 'withdrawal', 'wire', 'checking', 'routing', 'overdraft', 'fee', 'chargeback', 'deposit', 'teller', 'atm', 'balance', 'insufficient', 'funds', 'cleared', 'pending'],
      // Fraud & Disputed Charges
      ['scam', 'fraud', 'stolen', 'hacked', 'dispute', 'merchant', 'transaction', 'claim', 'stolen', 'card', 'identity', 'theft', 'compromised', 'frozen', 'locked'],
      // Taxes & IRS
      ['tax', 'irs', 'refund', 'filing', 'deduction', 'audit', 'income', 'capital', 'gains', 'w2', '1099', 'write-off', 'dependents', 'bracket', 'evasion', 'schedule', 'cpa', 'return', 'withholding'],
      // Markets, Trading & Investing
      ['stock', 'market', 'portfolio', 'dividend', 'index', 'etf', 'brokerage', 'trading', 'options', 'margin', 'bull', 'bear', 'nasdaq', 'spy', 'bonds', 'yield', 'shares', 'equity', 'ipo', 'broker'],
      // Crypto & Web3
      ['crypto', 'wallet', 'seed', 'private', 'blockchain', 'bitcoin', 'ethereum', 'exchange', 'ledger', 'cold', 'storage', 'gas', 'token', 'nft', 'defi', 'staking', 'altcoin', 'mining'],
      // Credit & Debt Management
      ['debt', 'credit', 'score', 'loan', 'mortgage', 'interest', 'apr', 'collection', 'bankruptcy', 'equifax', 'experian', 'transunion', 'utilization', 'default', 'consolidation', 'payoff', 'principal', 'garnishment'],
      // Personal Finance & Budgeting
      ['budget', 'spending', 'savings', 'expenses', 'frugal', 'retirement', '401k', 'ira', 'pension', 'roth', 'compound', 'yield', 'apy', 'inflation', 'fire', 'net', 'worth', 'emergency', 'fund'],
      // Corporate Finance & Income
      ['salary', 'bonus', 'commission', 'equity', 'worth', 'assets', 'liability', 'financial', 'revenue', 'profit', 'margin', 'valuation', 'startup', 'seed', 'funding', 'vc', 'angel', 'cashflow', 'p&l', 'balance', 'sheet'],
      // Real Estate Investing
      ['property', 'reit', 'rental', 'cashflow', 'appreciation', 'depreciation', 'equity', 'escrow', 'appraisal', 'closing', 'refinance', 'heloc', 'mortgage', 'amortization', 'down', 'payment', 'interest', 'rate'],
      // Paycheck & Wage Issues
      ['paycheck', 'short-changed', 'dollars', '$', 'wages', 'stub', 'deduction', 'gross', 'net', 'hourly', 'salary', 'reimbursement', 'expense', 'report']
    ]
  },
  {
    id: 'guardian',
    weight: 2.5,
    clusters: [
      // Data Breaches & Auth
      ['password', 'compromised', 'leak', 'data', 'breach', 'auth', 'security', 'login', '2fa', 'mfa', 'biometric', 'credential', 'stuffing', 'dark', 'web', 'hacker', 'exploit', 'zero-day'],
      // Social Engineering & Scams
      ['scam', 'phishing', 'smishing', 'link', 'text', 'email', 'fraudulent', 'identity', 'catfish', 'blackmail', 'extortion', 'spoofing', 'impersonation', 'nigerian', 'prince', 'gift', 'card', 'wire', 'urgent'],
      // Physical & Cyber Stalking
      ['stalker', 'threat', 'harassment', 'tracking', 'location', 'hidden', 'camera', 'privacy', 'airtag', 'gps', 'doxxing', 'swatting', 'restraining', 'order', 'followed', 'watched', 'surveillance'],
      // Malware & Network Security
      ['malware', 'virus', 'trojan', 'ransomware', 'spyware', 'infected', 'pop-up', 'blocked', 'firewall', 'vpn', 'encryption', 'ddos', 'botnet', 'rootkit', 'keylogger', 'antivirus', 'scan', 'quarantine'],
      // Physical Security & Hardware
      ['perimeter', 'security', 'alarm', 'intrusion', 'motion', 'sensor', 'alert', 'lock', 'deadbolt', 'safe', 'cctv', 'footage', 'breached', 'keypad', 'rfid', 'biometrics', 'guard', 'patrol'],
      // Device Protection
      ['lost', 'stolen', 'wipe', 'remote', 'lock', 'find', 'my', 'iphone', 'android', 'tracker', 'imei', 'blacklist', 'sim', 'swap', 'hijack']
    ]
  },
  {
    id: 'mechanic',
    weight: 1.5,
    clusters: [
      // ICE Powertrain & Underhood
      ['engine', 'oil', 'transmission', 'overheating', 'coolant', 'shaking', 'stalling', 'exhaust', 'spark', 'plug', 'cylinder', 'gasket', 'radiator', 'muffler', 'belt', 'timing', 'pump', 'alternator', 'filter', 'valves'],
      // Chassis, Suspension & Brakes
      ['brakes', 'grinding', 'squeaking', 'rotor', 'caliper', 'pedal', 'fluid', 'stopping', 'pads', 'abs', 'suspension', 'strut', 'shock', 'steering', 'alignment', 'axel', 'cv', 'joint', 'bearings', 'tie', 'rod'],
      // Auto Electrical & EV
      ['battery', 'alternator', 'starter', 'ignition', 'wires', 'electrical', 'fuse', 'tesla', 'ev', 'charging', 'inverter', 'motor', 'range', 'sensor', 'dashboard', 'lights', 'obd2', 'scanner', 'code'],
      // Tires & Wheels
      ['tire', 'flat', 'alignment', 'tread', 'pressure', 'psi', 'puncture', 'patch', 'plug', 'rim', 'alloy', 'lug', 'nut', 'torque', 'balance', 'rotation'],
      // PC Hardware & Custom Builds
      ['laptop', 'software', 'crash', 'reboot', 'update', 'drivers', 'bios', 'hardware', 'motherboard', 'cpu', 'gpu', 'ram', 'psu', 'thermal', 'paste', 'boot', 'ssd', 'hdd', 'nvme', 'cooler', 'overclock'],
      // Networking & IT
      ['wifi', 'internet', 'router', 'connection', 'signal', 'bandwidth', 'ethernet', 'modem', 'isp', 'latency', 'ping', 'packet', 'loss', 'dns', 'ip', 'mac', 'address', 'port', 'forwarding', 'mesh'],
      // Mobile Devices & Gadgets
      ['iphone', 'android', 'screen', 'cracked', 'port', 'lightning', 'usb-c', 'glitch', 'frozen', 'bricked', 'factory', 'reset', 'jailbreak', 'root', 'digitizer', 'oled', 'battery', 'degradation'],
      // Home Appliances & HVAC
      ['fridge', 'refrigerator', 'compressor', 'hvac', 'ac', 'heater', 'furnace', 'washing', 'dryer', 'dishwasher', 'plumbing', 'leak', 'clog', 'valve', 'thermostat', 'freon', 'duct', 'vent', 'filter'],
      // Tools & DIY
      ['wrench', 'socket', 'drill', 'saw', 'hammer', 'pliers', 'screwdriver', 'impact', 'torque', 'multimeter', 'soldering', 'iron', 'welding', 'compressor', 'jack', 'stands']
    ]
  },
  {
    id: 'career',
    weight: 1.8,
    clusters: [
      // Application & Resume Process
      ['resume', 'cv', 'profile', 'ats', 'optimization', 'keyword', 'application', 'portfolio', 'cover', 'letter', 'linkedin', 'github', 'references', 'formatting', 'bullet', 'points', 'summary'],
      // Interviewing & Hiring
      ['interview', 'hiring', 'recruiter', 'hr', 'offer', 'negotiation', 'benefits', 'onboarding', 'technical', 'behavioral', 'panel', 'whiteboard', 'ghosted', 'follow-up', 'thank', 'you', 'screening', 'assessment'],
      // Workplace Dynamics & Politics
      ['boss', 'manager', 'leadership', 'corporate', 'office', 'politics', 'feedback', 'review', 'coworker', 'micromanager', 'culture', 'performance', 'pip', 'meeting', 'agile', 'sprint', 'scrum', 'stakeholder'],
      // Growth, Promotion & Salary
      ['promotion', 'raise', 'advance', 'trajectory', 'career', 'pivot', 'networking', 'referral', 'mentor', 'upskill', 'certification', 'degree', 'transition', 'evaluation', 'goals', 'kpi', 'okr', 'compensation', 'equity'],
      // Exit, Burnout & Termination
      ['burnout', 'toxic', 'culture', 'quit', 'notice', 'resignation', 'layoff', 'severance', 'unemployment', 'fired', 'restructuring', 'two-weeks', 'exit', 'interview', 'coap', 'non-compete'],
      // Freelance & Consulting
      ['freelance', 'contractor', '1099', 'client', 'retainer', 'agency', 'consulting', 'proposal', 'pitch', 'rates', 'invoicing', 'deliverable', 'scope', 'creep', 'portfolio', 'marketing', 'outreach'],
      // Work-Life Balance
      ['remote', 'hybrid', 'commute', 'wfh', 'pto', 'vacation', 'leave', 'sabbatical', 'boundaries', 'overworked', 'delegate']
    ]
  },
  {
    id: 'therapist',
    weight: 2.0,
    clusters: [
      // Anxiety & Stress Disorders
      ['anxiety', 'panic', 'stress', 'overwhelmed', 'pacing', 'heart-rate', 'unfocused', 'worry', 'racing', 'thoughts', 'dread', 'nervous', 'breakdown', 'hyperventilation', 'attack', 'social', 'phobia', 'ocd', 'compulsion', 'obsession'],
      // Depression & Grief
      ['depressed', 'sad', 'hopeless', 'lonely', 'grief', 'loss', 'mourning', 'heavy', 'empty', 'numb', 'apathy', 'motivation', 'crying', 'bed', 'dark', 'suicidal', 'ideation', 'harm', 'melancholy', 'isolation'],
      // Relationship Psychology & Dynamics
      ['boundary', 'relationship', 'conflict', 'argument', 'toxic', 'gaslight', 'narcissist', 'healing', 'codependent', 'attachment', 'avoidant', 'anxious', 'abandonment', 'enmeshment', 'manipulation', 'couples', 'communication'],
      // Trauma & PTSD
      ['trauma', 'ptsd', 'trigger', 'flashback', 'nightmare', 'therapy', 'counseling', 'session', 'abuse', 'neglect', 'childhood', 'emdr', 'dissociation', 'cptsd', 'somatic', 'nervous', 'system', 'regulation'],
      // Self-Worth, Identity & Ego
      ['self-esteem', 'worth', 'confidence', 'imposter', 'shame', 'guilt', 'forgiveness', 'peace', 'validation', 'inadequate', 'perfectionism', 'inner-critic', 'identity', 'crisis', 'purpose', 'meaning', 'acceptance'],
      // Neurodivergence & Cognitive
      ['adhd', 'autism', 'spectrum', 'focus', 'executive', 'dysfunction', 'hyperfocus', 'overstimulation', 'sensory', 'burnout', 'masking', 'dopamine', 'regulation', 'task', 'paralysis'],
      // Addiction & Recovery
      ['addiction', 'substance', 'relapse', 'sobriety', 'craving', 'withdrawal', 'alcohol', 'drugs', 'rehab', 'sponsor', 'meetings', '12-step', 'compulsive', 'gambling', 'dependence'],
      // Emotional Regulation
      ['anger', 'rage', 'outburst', 'frustration', 'irritability', 'mood', 'swings', 'bipolar', 'mania', 'hypomania', 'grounding', 'mindfulness', 'meditation', 'breathing']
    ]
  },
  {
    id: 'vitality',
    weight: 1.6,
    clusters: [
      // Hypertrophy & Strength Training
      ['workout', 'exercise', 'gym', 'training', 'routine', 'sets', 'reps', 'muscle', 'hypertrophy', 'lifting', 'squat', 'bench', 'deadlift', 'pr', 'barbell', 'dumbbell', 'form', 'progressive', 'overload', 'split', 'push', 'pull', 'legs'],
      // Nutrition, Diet & Macros
      ['diet', 'nutrition', 'calories', 'protein', 'macros', 'meal-prep', 'intermittent', 'fasting', 'keto', 'vegan', 'carbs', 'fats', 'deficit', 'surplus', 'bulking', 'cutting', 'tracking', 'myfitnesspal', 'sugar', 'fiber', 'micronutrients'],
      // Sleep, Recovery & Wearables
      ['sleep', 'rem', 'recovery', 'strain', 'rest', 'insomnia', 'circadian', 'melatonin', 'fatigue', 'deep', 'wearable', 'whoop', 'oura', 'hrv', 'apple', 'watch', 'garmin', 'rhr', 'temperature', 'rhythm'],
      // Physiology, Hormones & Supplements
      ['weight', 'loss', 'shred', 'bulk', 'metabolism', 'supplements', 'vitamins', 'performance', 'creatine', 'pre-workout', 'whey', 'testosterone', 'hormones', 'cortisol', 'insulin', 'thyroid', 'amino', 'bcaas'],
      // Mobility, Endurance & Cardio
      ['stretching', 'mobility', 'yoga', 'pilates', 'flexibility', 'running', 'marathon', 'sprint', 'zone2', 'aerobic', 'anaerobic', 'vo2', 'endurance', 'cycling', 'swimming', 'rowing', 'hiit', 'plyometrics', 'warmup', 'cooldown'],
      // Biohacking & Optimization
      ['cold', 'plunge', 'sauna', 'heat', 'exposure', 'red', 'light', 'therapy', 'nootropics', 'caffeine', 'l-theanine', 'ashwagandha', 'magnesium', 'zinc', 'bloodwork', 'panel', 'optimization']
    ]
  },
  {
    id: 'tutor',
    weight: 1.5,
    clusters: [
      // General Academics & Study Skills
      ['study', 'exam', 'test', 'grades', 'homework', 'assignment', 'essay', 'thesis', 'research', 'flashcards', 'memorize', 'syllabus', 'cramming', 'pomodoro', 'notes', 'lecture', 'professor', 'gpa', 'transcript', 'plagiarism'],
      // STEM: Math & Physics
      ['math', 'algebra', 'calculus', 'physics', 'geometry', 'equations', 'logic', 'proof', 'trigonometry', 'statistics', 'probability', 'derivatives', 'integrals', 'vectors', 'kinematics', 'thermodynamics', 'quantum', 'mechanics', 'formulas'],
      // STEM: Computer Science & IT
      ['code', 'python', 'javascript', 'react', 'typescript', 'algorithm', 'syntax', 'debugging', 'compile', 'html', 'css', 'database', 'sql', 'api', 'git', 'terminal', 'oop', 'data', 'structures', 'loops', 'functions', 'variables', 'arrays'],
      // Humanities, Science & Liberal Arts
      ['history', 'literature', 'language', 'science', 'biology', 'chemistry', 'concept', 'simplify', 'geography', 'philosophy', 'sociology', 'grammar', 'molecules', 'cells', 'dna', 'periodic', 'table', 'reactions', 'essay', 'structure', 'citations', 'mla', 'apa'],
      // Standardized Testing & Admissions
      ['sat', 'act', 'gre', 'gmat', 'lsat', 'mcat', 'prep', 'score', 'percentile', 'admissions', 'college', 'university', 'scholarship', 'application', 'essay', 'prompt', 'extracurriculars', 'ivy', 'league']
    ]
  },
  {
    id: 'pastor',
    weight: 1.8,
    clusters: [
      // Scripture, Theology & Study
      ['bible', 'scripture', 'verse', 'chapter', 'gospel', 'testament', 'psalm', 'proverbs', 'theology', 'doctrine', 'revelation', 'genesis', 'epistles', 'torah', 'prophets', 'exegesis', 'hermeneutics', 'commentary', 'concordance'],
      // Worship, Church Life & Community
      ['prayer', 'intercede', 'worship', 'praise', 'fellowship', 'church', 'ministry', 'faith', 'congregation', 'sermon', 'pastor', 'sacrament', 'baptism', 'communion', 'tithe', 'offering', 'small', 'group', 'volunteering', 'missions'],
      // Soteriology, Morality & Salvation
      ['sin', 'repent', 'grace', 'mercy', 'redemption', 'holy', 'spirit', 'god', 'jesus', 'lord', 'christ', 'salvation', 'forgiveness', 'cross', 'resurrection', 'atonement', 'justification', 'sanctification', 'glorification'],
      // Spiritual Warfare, Guidance & Counseling
      ['temptation', 'doubt', 'spiritual', 'warfare', 'discernment', 'wisdom', 'blessing', 'purpose', 'calling', 'peace', 'fasting', 'sanctification', 'trials', 'tribulation', 'demonic', 'oppression', 'armor', 'god', 'fast', 'retreat'],
      // Life Milestones & Pastoral Care
      ['marriage', 'counseling', 'premarital', 'wedding', 'vows', 'funeral', 'eulogy', 'grief', 'comfort', 'visitation', 'hospital', 'chaplain', 'dedication', 'christening']
    ]
  },
  {
    id: 'hype',
    weight: 1.4,
    clusters: [
      // Social Media, Virality & Algorithms
      ['viral', 'tiktok', 'reels', 'algorithm', 'content', 'strategy', 'hook', 'trending', 'engagement', 'views', 'followers', 'foryou', 'fyp', 'shorts', 'shadowban', 'analytics', 'retention', 'watch', 'time', 'ctr', 'thumbnail'],
      // Comedy, Scripting & Entertainment
      ['joke', 'funny', 'prank', 'comedy', 'humor', 'script', 'skit', 'punchline', 'satire', 'roast', 'meme', 'irony', 'parody', 'bit', 'standup', 'crowd', 'work', 'heckler'],
      // Culture, Aesthetics & Slang
      ['slang', 'rizz', 'cap', 'aura', 'hype', 'energy', 'vibe', 'aesthetic', 'drop', 'launch', 'drip', 'fit', 'based', 'cringe', 'era', 'mid', 'sus', 'bussin', 'bet', 'no', 'shot', 'w', 'l', 'ratio'],
      // Brand, Monetization & Creator Economy
      ['sponsor', 'brand', 'deal', 'monetize', 'collab', 'merch', 'creator', 'influencer', 'ad', 'revenue', 'affiliate', 'conversion', 'patreon', 'onlyfans', 'twitch', 'stream', 'sub', 'donation', 'superchat', 'cpm', 'rpm'],
      // Production & Editing
      ['edit', 'capcut', 'premiere', 'final', 'cut', 'transition', 'b-roll', 'audio', 'lighting', 'ring', 'light', 'mic', 'camera', 'setup', 'vlog', 'stream', 'obs', 'layout']
    ]
  },
  {
    id: 'bestie',
    weight: 1.2,
    clusters: [
      // Gossip, Venting & Friend Drama
      ['drama', 'tea', 'gossip', 'spill', 'shady', 'fake', 'friends', 'bestie', 'vent', 'rant', 'annoying', 'bitch', 'petty', 'spiteful', 'two-faced', 'backstab', 'jealous', 'rumor', 'receipts', 'screenshot', 'group', 'chat'],
      // Dating, Romance & Situationships
      ['date', 'crush', 'hookup', 'hinge', 'tinder', 'red-flag', 'situationship', 'ghosted', 'blocked', 'text', 'reply', 'ex', 'boyfriend', 'girlfriend', 'bumble', 'raya', 'ick', 'talking', 'stage', 'flirting', 'roster', 'soft', 'launch'],
      // Fashion, Beauty & Lifestyle
      ['outfit', 'style', 'slay', 'look', 'shopping', 'makeup', 'hair', 'nails', 'confidence', 'glow-up', 'cute', 'gorgeous', 'skincare', 'routine', 'haul', 'zara', 'sephora', 'aesthetic', 'inspo', 'pinterest'],
      // Casual Emotion, Reactions & Hangouts
      ['mood', 'tired', 'bored', 'obsessed', 'literally', 'crying', 'screaming', 'love', 'hate', 'delusional', 'unbothered', 'manifesting', 'weekend', 'brunch', 'drinks', 'club', 'party', 'trip', 'girls', 'night', 'vibing']
    ]
  }
];

export const detectExpertSuggestion = (
  text: string, 
  currentId: string, 
  personas: PersonaConfig[]
): PersonaConfig | null => {
  const lower = text.toLowerCase();
  
  // Normalize the text: remove punctuation so words match perfectly against the array
  const cleanText = lower.replace(/[^\w\s-]/g, '');
  const words = cleanText.split(/\s+/);
  
  let bestMatch: { id: string, score: number } | null = null;

  EXPERT_CONTEXTS.forEach(config => {
    // 1. Skip if the expert is already active
    if (config.id === currentId) return;

    let totalScore = 0;
    
    // 2. Scan every massive cluster
    config.clusters.forEach(cluster => {
      // Find exact word matches within the text array to avoid partial matches (e.g., "car" matching "career")
      const matches = cluster.filter(keyword => words.includes(keyword));
      
      // DOUBLE-LOCK: At least 2 distinct keywords from the SAME cluster must be present
      if (matches.length >= 2) {
        // High-definition scoring:
        // 2 matches = 2.82 * weight
        // 3 matches = 5.19 * weight
        // 4 matches = 8.00 * weight
        totalScore += (Math.pow(matches.length, 1.5) * config.weight);
      }
    });

    // 3. Keep the highest scoring expert
    if (totalScore > 0 && (!bestMatch || totalScore > bestMatch.score)) {
      bestMatch = { id: config.id, score: totalScore };
    }
  });

  // 4. Final verification threshold. 
  // A score of 5.0 ensures that at least one highly weighted cluster double-locked, 
  // or multiple lower-weighted clusters double-locked.
  if (bestMatch && bestMatch.score >= 5.0) {
    return personas.find(p => p.id === bestMatch!.id) || null;
  }
  
  return null;
};
