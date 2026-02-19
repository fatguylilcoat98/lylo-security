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
      ['habeas corpus', 'mens rea', 'actus reus', 'indictment', 'arraignment', 'plea bargain', 'acquittal', 'probable cause', 'testimony', 'forensic', 'bail', 'subpoena', 'jurisdiction', 'cross-examination', 'mitigation', 'sentencing', 'parole', 'probation', 'alibi', 'jurisprudence', 'double jeopardy', 'entrapment', 'felony', 'misdemeanor', 'pre-trial'],
      ['tort', 'negligence', 'defamation', 'libel', 'slander', 'damages', 'injunction', 'liability', 'breach of contract', 'settlement', 'class action', 'compensation', 'equity', 'statute of limitations', 'appeal', 'restitution', 'subrogation', 'contractual', 'indemnity', 'lien', 'mandamus', 'remedy', 'quasi-contract', 'ultra vires'],
      ['patent', 'trademark', 'copyright', 'infringement', 'licensing', 'trade secret', 'prior art', 'fair use', 'plagiarism', 'royalty', 'IPR', 'patent pending', 'application', 'brand', 'geographical indication', 'non-disclosure', 'counterfeit', 'parallel import', 'patent troll', 'exclusive rights'],
      ['easement', 'zoning', 'title', 'mortgage', 'foreclosure', 'property tax', 'deed', 'escrow', 'lease', 'tenancy', 'appraisal', 'closing', 'encumbrance', 'depreciation', 'investment property', 'landlord', 'tenant', 'sublease', 'homestead', 'realty', 'survey', 'covenant', 'annexation', 'conveyance', 'joint tenancy'],
      ['offer', 'acceptance', 'consideration', 'bilateral contract', 'unilateral contract', 'voidable', 'breach', 'rescission', 'novation', 'serious intent', 'duress', 'unconscionability', 'assignment', 'delegation', 'performance', 'force majeure', 'promissory estoppel', 'reformation', 'specific performance', 'condition precedent'],
      ['custody', 'alimony', 'annulment', 'prenuptial', 'adoption', 'divorce', 'paternity', 'guardianship', 'emancipation', 'spousal support', 'marital property', 'domestic violence', 'order of protection', 'surrogacy', 'foster care', 'visitation rights', 'child support', 'parental rights', 'cohabitation', 'domestic partnership'],
      ['admiralty', 'salvage', 'bill of lading', 'jettison', 'maritime lien', 'seaworthiness', 'cargo', 'fathom', 'pilotage', 'demurrage', 'jurisdiction', 'collision', 'hinterland', 'averaging', 'stevedore', 'blockade', 'maritime insurance', 'bareboat charter', 'cargo claim', 'longshoreman'],
      ['treaty', 'sanctions', 'extradition', 'sovereignty', 'human rights', 'diplomacy', 'arbitration', 'jurisdiction', 'embargo', 'war crimes', 'customary law', 'recognition', 'possession', 'non-proliferation', 'territorial integrity', 'peacekeeping', 'international tribunal', 'genocide', 'insurgency', 'bilateral'],
      ['EPA', 'emissions', 'conservation', 'biodiversity', 'pollution', 'sustainability', 'carbon footprint', 'climate change', 'ecosystem', 'habitat', 'natural resources', 'endangered species', 'impact assessment', 'greenhouse gases', 'recycling', 'conservation easement', 'renewable energy', 'water rights', 'toxic waste', 'acid rain'],
      ['fiduciary duty', 'mergers', 'acquisitions', 'shareholder', 'board of directors', 'liquidation', 'corporate governance', 'equity', 'IPO', 'compliance', 'stock options', 'hostile takeover', 'proxy', 'subsidiary', 'joint venture', 'corporate veil', 'derivative suit', 'antitrust', 'synergy', 'stakeholder'],
      ['discrimination', 'workers compensation', 'unemployment', 'harassment', 'OSHA', 'wage and hour', 'collective bargaining', 'whistleblower', 'severance', 'benefits', 'wrongful termination', 'reasonable accommodation', 'FMLA', 'overtime', 'workplace privacy', 'retaliation', 'vicarious liability', 'labor union', 'minimum wage', 'right to work'],
      ['IRS', 'deduction', 'incorporation', 'estate tax', 'capital gains', 'audit', 'tax lien', 'evasion', 'compliance', 'return', 'liability', 'withholding', 'exemption', 'credit', 'depreciation', 'income tax', 'corporate tax', 'VAT', 'charitable contribution', 'tax haven']
    ]
  },
  {
    id: 'doctor',
    weight: 2.8,
    clusters: [
      ['arrhythmia', 'myocardial infarction', 'echocardiogram', 'angioplasty', 'atherosclerosis', 'bradycardia', 'cardiomyopathy', 'cholesterol', 'hypertension', 'mitral valve', 'pericarditis', 'stent', 'tachycardia', 'ventricular', 'atrial fibrillation', 'electrocardiogram', 'heart failure', 'pacemaker', 'thrombosis', 'atheroma'],
      ['neurons', 'synapse', 'epilepsy', 'multiple sclerosis', 'neuropathy', 'alzheimer’s', 'parkinson’s', 'migraine', 'stroke', 'cerebral palsy', 'dementia', 'tremor', 'myelin', 'seizures', 'neurological disorder', 'cerebellum', 'brainstem', 'axons', 'dyskinesia', 'neurotransmitter'],
      ['tumor', 'chemotherapy', 'radiation', 'benign', 'malignant', 'metastasis', 'carcinoma', 'sarcoma', 'lymphoma', 'biopsy', 'immunotherapy', 'remission', 'palliative care', 'oncogenes', 'neoplasm', 'screening', 'cytotoxic', 'brachytherapy', 'melanoma', 'cancer staging'],
      ['vaccination', 'neonatology', 'growth chart', 'asthma', 'ADHD', 'immunization', 'congenital', 'pediatrician', 'developmental milestones', 'autism', 'infant', 'colic', 'nursery', 'adolescence', 'puberty', 'well-baby exam', 'SIDS', 'teething', 'tonsillitis', 'otitis media'],
      ['fracture', 'osteoporosis', 'arthritis', 'scoliosis', 'ligament', 'tendon', 'bursitis', 'cartilage', 'prosthetics', 'orthotics', 'spinal fusion', 'arthroscopy', 'vertebrae', 'meniscus', 'joint replacement', 'osteotomy', 'skeletal', 'musculoskeletal', 'fibromyalgia', 'kyphosis'],
      ['psoriasis', 'eczema', 'melanoma', 'dermatitis', 'acne', 'rosacea', 'biopsy', 'cryotherapy', 'laser therapy', 'keratosis', 'ulcer', 'alopecia', 'histology', 'basal cell carcinoma', 'squamous cell carcinoma', 'cosmetic dermatology', 'pigmentation', 'dermal', 'botox', 'phototherapy'],
      ['bipolar disorder', 'schizophrenia', 'depression', 'anxiety', 'psychotherapy', 'cognitive behavioral therapy', 'antidepressants', 'psychosis', 'mood disorder', 'PTSD', 'obsessive-compulsive disorder', 'borderline personality disorder', 'mental health', 'psychiatrist', 'counseling', 'somatic', 'psychosomatic', 'addiction', 'anxiolytics', 'schizoaffective'],
      ['diabetes', 'insulin', 'thyroid', 'metabolism', 'hormones', 'endocrine glands', 'cushing’s syndrome', 'adrenal', 'pituitary', 'parathyroid', 'glucose', 'glycated hemoglobin', 'hypoglycemia', 'hypercorticism', 'hypothyroidism', 'islets of langerhans', 'pancreatic', 'osteopenia', 'thyrotoxicosis', 'hormonal imbalance'],
      ['gastroesophageal reflux', 'ulcer', 'crohn’s disease', 'colitis', 'hepatitis', 'liver', 'pancreas', 'endoscopy', 'probiotics', 'gallstones', 'biliary', 'constipation', 'bariatric', 'gut microbiome', 'celiac disease', 'digestive system', 'small intestine', 'enteritis', 'polyps', 'fecal transplants'],
      ['cataract', 'glaucoma', 'retina', 'optometry', 'ophthalmoscope', 'astigmatism', 'myopia', 'retinopathy', 'cornea', 'ocular', 'vision therapy', 'intraocular', 'laser surgery', 'strabismus', 'visual acuity', 'lens', 'presbyopia', 'sclera', 'color blindness', 'macular degeneration']
    ]
  },
  {
    id: 'wealth',
    weight: 2.2,
    clusters: [
      ['portfolio', 'diversification', 'asset allocation', 'mutual fund', 'ETF', 'equities', 'bonds', 'commodities', 'real estate investment trust', 'hedge fund', 'DER derivatives', 'index fund', 'market capitalization', 'penny stock', 'bull market', 'bear market', 'blue-chip stocks', 'yield', 'volatility', 'risk management'],
      ['budgeting', 'savings account', 'checking account', 'interest rate', 'credit score', 'debt consolidation', 'emergency fund', 'cash flow', 'expense ratio', 'financial planning', '401(k)', 'IRA', 'Roth IRA', 'compound interest', 'liquidity', 'annuities', 'retirement planning', 'life insurance', 'net worth', 'financial literacy'],
      ['tax bracket', 'deductions', 'credits', 'capital gains tax', 'estate planning', 'gift tax', 'income tax', 'tax-deferred', 'tax-exempt', 'withholding', 'alternative minimum tax', 'tax audit', 'tax shelter', 'tax liability', 'standard deduction', 'itemized deduction', 'tax loophole', 'country by country reporting', 'foreign tax credit', 'inheritance tax'],
      ['fiduciary', 'estate', 'trust', 'endowment', 'wealth preservation', 'asset protection', 'succession planning', 'charitable giving', 'philanthropy', 'family office', 'capital preservation', 'income distribution', 'asset rebalancing', 'risk profile', 'financial advisor'],
      ['mortgage', 'appreciation', 'cash flow', 'rental income', 'property management', 'flipping', 'land development', 'foreclosure', 'turnkey property', 'capital improvements', 'home equity', 'real estate agent', 'real estate market', 'landlord', 'tenant rights', 'buy and hold', 'short sale', 'zoning laws', 'tax lien', 'property tax'],
      ['startup', 'angel investor', 'venture capital', 'bootstrapping', 'scalable', 'minimum viable product', 'equity crowdfunding', 'business plan', 'cash burn rate', 'exit strategy', 'intellectual property', 'branding', 'seed funding', 'business model canvas', 'product-market fit', 'lean startup', 'pivot', 'acquisition', 'valuation', 'co-founder'],
      ['gross domestic product', 'inflation rate', 'unemployment rate', 'consumer confidence index', 'producer price index', 'balance of trade', 'interest rates', 'money supply', 'quantitative easing', 'fiscal policy', 'monetary policy', 'exchange rates', 'national debt', 'budget deficit', 'economic growth', 'recession', 'depression', 'stagflation', 'hyperinflation', 'economic cycle']
    ]
  },
  {
    id: 'guardian',
    weight: 2.5,
    clusters: [
      ['firewall', 'encryption', 'malware', 'phishing', 'ransomware', 'zero-day exploit', 'penetration testing', 'VPN', 'two-factor authentication', 'intrusion detection', 'cyber threat', 'botnet', 'cipher', 'data breach', 'social engineering', 'DDoS attack', 'endpoint security', 'hashing', 'digital certificate', 'cyber forensics'],
      ['access control', 'CCTV', 'biometrics', 'perimeter security', 'alarm systems', 'intrusion detection', 'security guards', 'turnstiles', 'security barriers', 'video surveillance', 'motion detectors', 'reinforced doors', 'surveillance cameras', 'security protocols', 'mantraps', 'magnetic locks', 'security lighting', 'panic buttons', 'guard patrol', 'intrusion prevention'],
      ['data encryption', 'information governance', 'data integrity', 'privacy policy', 'data loss prevention', 'confidentiality', 'authentication', 'authorization', 'access control', 'data classification', 'cyber hygiene', 'security policy', 'compliance', 'data masking', 'threat modeling', 'security token', 'intrusion prevention system', 'sensitive data', 'log monitoring', 'security posture'],
      ['firewall rules', 'DMZ (demilitarized zone)', 'proxy server', 'network segmentation', 'sniffing', 'packet filtering', 'network intrusion detection', 'Wi-Fi security', 'SSL/TLS encryption', 'IPsec', 'network protocol', 'VPN tunneling', 'network access control', 'router security', 'network threat', 'bandwidth monitoring', 'man-in-the-middle attack', 'wireless security', 'traffic analysis', 'secure VPN'],
      ['contingency planning', 'disaster recovery', 'crisis management', 'evacuation procedures', 'risk assessment', 'business continuity', 'emergency response', 'incident management', 'resilience', 'vulnerability analysis', 'emergency communication', 'first responders', 'shelter-in-place', 'recovery time objective', 'critical infrastructure', 'evacuation plan', 'natural disasters', 'emergency drills', 'response time', 'continuity of operations'],
      ['self-defense', 'situational awareness', 'personal alarms', 'bulletproof vest', 'home security', 'pepper spray', 'safeguarding', 'trust but verify', 'personal safety app', 'background checks', 'identity theft protection', 'safe zones', 'security advice', 'public safety', 'stalking prevention', 'bodyguard', 'personal protection', 'risk avoidance', 'social media privacy', 'awareness training']
    ]
  },
  {
    id: 'mechanic',
    weight: 1.5,
    clusters: [
      ['transmission', 'alternator', 'catalytic converter', 'spark plug', 'fuel injector', 'drive shaft', 'suspension', 'brake caliper', 'torque converter', 'oxygen sensor', 'radiator', 'exhaust manifold', 'axle', 'power steering', 'timing belt', 'tire rotation', 'engine diagnostics', 'oil filter', 'camshaft', 'wheel alignment', 'differential', 'turbocharger', 'clutch', 'serpentine belt', 'fuel pump', 'shock absorber', 'crankshaft', 'overhead camshaft', 'ignition coil', 'ABS system'],
      ['HVAC', 'plumbing', 'circuit breaker', 'fuse box', 'insulation', 'drywall', 'roofing', 'sump pump', 'pest control', 'appliance repair', 'toolbox', 'wiring', 'caulking', 'water heater', 'foundation', 'gutter cleaning', 'leak detection', 'smoke detector', 'home automation', 'energy efficiency', 'flooring', 'tile setting', 'grout', 'cabinet installation', 'landscaping', 'septic system', 'window installation', 'drainage', 'window glazing', 'security system'],
      ['motherboard', 'CPU', 'RAM', 'SSD', 'graphics card', 'network router', 'USB port', 'operating system', 'firewall', 'software patch', 'bluetooth', 'Wi-Fi', 'cloud storage', 'virtual machine', 'encryption', 'firmware update', 'data recovery', 'hardware interface', 'system integration', 'IT support', 'peripheral', 'IoT (Internet of Things)', 'machine learning', 'AI algorithms', 'data mining', 'software development', 'version control', 'cybersecurity', 'network topology', 'multi-factor authentication'],
      ['circuit', 'voltage', 'amperage', 'resistance', 'conduit', 'transformer', 'alternating current', 'direct current', 'fuse', 'switchgear', 'relay', 'generator', 'power distribution', 'load center', 'thermal overload', 'grounding', 'surge protection', 'electrical panel', 'wattage', 'breaker panel', 'insulation resistance', 'solar panels', 'inverter', 'microcontroller', 'semiconductors', 'diode', 'availability management', 'power standards', 'circuit breaker', 'electric meter'],
      ['thermostat', 'refrigerant', 'ductwork', 'heat pump', 'evaporator coil', 'furnace', 'air conditioning', 'dehumidifier', 'ventilation', 'zone control', 'filter replacement', 'compressor', 'air handler', 'chiller', 'humidistat', 'BTU (British Thermal Unit)', 'indoor air quality', 'draft prevention', 'cooling cycle', 'HVAC zoning', 'venturi effect', 'heat exchanger', 'condensing unit', 'dryer systems', 'airflow distribution', 'condenser coil', 'thermodynamics', 'system efficiency', 'environmental controls', 'energy audit'],
      ['joinery', 'saw', 'lathe', 'chisel', 'sanding', 'wood grain', 'dovetail', 'tenon', 'miter cut', 'planer', 'cabinet making', 'woodworking', 'framing', 'finish carpentry', 'veneer', 'craftsmanship', 'measure twice, cut once', 'lumber', 'block plane', 'hinges', 'mortise', 'hand plane', 'band saw', 'router table', 'drill press', 'jigsaw', 'timber framing', 'veneer press', 'hand tools', 'wood finishing']
    ]
  },
  {
    id: 'career',
    weight: 1.8,
    clusters: [
      ['goal setting', 'networking', 'mentoring', 'strengths finder', 'personal branding', 'career assessment', 'skill gap analysis', 'career ladder', 'job shadowing', 'professional development', 'career transition', 'job satisfaction', 'promotability', 'career pathing', 'time management', 'performance review', '360-degree feedback', 'interpersonal skills', 'work-life balance', 'career vision'],
      ['resume writing', 'cover letter', 'job application', 'interview preparation', 'job fair', 'LinkedIn optimization', 'job board', 'networking event', 'informational interview', 'elevator pitch', 'follow-up email', 'reference check', 'job offer negotiation', 'headhunter', 'applicant tracking system', 'job market research', 'gig economy', 'freelancing', 'online portfolio', 'virtual interview'],
      ['emotional intelligence', 'team building', 'conflict resolution', 'executive presence', 'strategic planning', 'delegation', 'decision making', 'visionary leadership', 'transformational leadership', 'coaching and mentoring', 'change management', 'cross-functional team', 'performance metrics', 'stakeholder management', 'leadership pipeline', 'ethical leadership', 'accountability', 'negotiation skills', 'diversity and inclusion', 'public speaking'],
      ['business plan', 'start-up', 'market research', 'product development', 'scalability', 'value proposition', 'minimum viable product', 'seed funding', 'angel investor', 'bootstrapping', 'marketing strategy', 'customer acquisition', 'business model innovation', 'pitch deck', 'venture capital', 'exit strategy', 'market validation', 'revenue streams', 'competitive advantage', 'lean startup'],
      ['time management', 'focus techniques', 'productivity tools', 'task prioritization', 'workflow optimization', 'procrastination avoidance', 'goal alignment', 'efficiency improvement', 'project management software', 'agile methodologies', 'scrum', 'Kanban', 'calendar management', 'batch processing', 'mind mapping', 'Pomodoro technique', 'deep work', 'digital detox', 'habit tracking', 'remote work optimization'],
      ['growth mindset', 'empathy development', 'self-reflection', 'mindfulness', 'positive psychology', 'cognitive behavioral techniques', 'emotional regulation', 'assertiveness training', 'self-discipline', 'confidence building', 'boundaries setting', 'stress management', 'resilience', 'influencing skills', 'development plan', 'values alignment', 'personal mission statement', 'life coaching', 'communication skills', 'creative thinking']
    ]
  },
  {
    id: 'therapist',
    weight: 2.0,
    clusters: [
      ['automatic thoughts', 'cognitive restructuring', 'exposure therapy', 'behavioral activation', 'core beliefs', 'thought record', 'schema', 'cognitive distortion', 'mindfulness', 'emotional regulation', 'rational emotive behavior therapy', 'self-monitoring', 'relaxation techniques', 'problem-solving therapy', 'motivational interviewing', 'desensitization', 'self-efficacy', 'stimulus control', 'behavior modification', 'cognitive restructuring'],
      ['transference', 'countertransference', 'defense mechanisms', 'free association', 'repression', 'unconscious mind', 'dream analysis', 'object relations', 'ego psychology', 'attachment theory', 'id', 'super ego', 'Oedipus complex', 'projection', 'sublimation', 'psychosexual stages', 'internal conflict', 'psychodynamic model', 'interpreting resistance', 'fantasy'],
      ['family dynamics', 'systemic therapy', 'genogram', 'triangulation', 'enmeshment', 'differentiation', 'nuclear family emotional system', 'family projection process', 'multigenerational transmission', 'family roles', 'conflict resolution', 'communication patterns', 'emotional cutoff', 'sibling rivalry', 'parenting styles', 'structural family therapy', 'intergenerational trauma', 'family lifecycle stages', 'narrative therapy', 'open communication'],
      ['PTSD', 'EMDR', 'trauma-informed care', 'flashbacks', 'dissociation', 'somatic experiencing', 'resilience building', 'grounding techniques', 'memory reconsolidation', 'vicarious trauma', 'attachment trauma', 'trauma bonding', 'hyperarousal', 'emotional numbing', 'neuroplasticity', 'trigger response', 'post-traumatic growth', 'complex trauma', 'exposure therapy', 'trauma processing'],
      ['self-actualization', 'client-centered therapy', 'unconditional positive regard', 'existential therapy', 'Gestalt therapy', 'phenomenology', 'authentic self', 'empathy', 'personal growth', 'meaning-making', 'Rogers’ six core conditions', 'self-concept', 'existential anxiety', 'congruence', 'creative self-expression', 'hierarchy of needs', 'person-centered approach', 'contact boundary', 'experiential learning', 'self-exploration'],
      ['group cohesion', 'interpersonal learning', 'feedback exchange', 'group dynamics', 'psychodrama', 'Therapeutic factors', 'role play', 'scapegoating', 'co-facilitation', 'group norms', 'altruism', 'universality', 'installation of hope', 'risk-taking', 'sculpting', 'intergroup conflict', 'peer support', 'shared experiences', 'facilitator roles', 'confidentiality']
    ]
  },
  {
    id: 'vitality',
    weight: 1.6,
    clusters: [
      ['hypertrophy', 'resistance training', 'free weights', 'compound exercises', 'isolation exercises', 'progressive overload', 'set and rep', 'muscular endurance', 'barbell', 'dumbbell', 'kettlebell', 'squat', 'deadlift', 'bench press', 'pull-up', 'push-up', 'circuit training', 'core stabilization', 'strength periodization', 'powerlifting'],
      ['aerobic capacity', 'VO2 max', 'endurance', 'interval training', 'anaerobic threshold', 'heart rate zone', 'treadmill', 'cycling', 'HIIT (High-Intensity Interval Training)', 'cardio-respiratory', 'marathon training', 'spin class', 'rowing', 'jump rope', 'pacing strategies', 'cool down', 'warm-up', 'lactate threshold', 'steady-state cardio', 'fitness tracker'],
      ['dynamic stretching', 'static stretching', 'proprioceptive neuromuscular facilitation', 'range of motion', 'mobility drills', 'yoga', 'Pilates', 'foam rolling', 'joint health', 'flexibility routine', 'active stretching', 'ballistic stretching', 'fascial release', 'muscle elasticity', 'stretch reflex', 'flexibility assessment', 'breathing techniques', 'balance training', 'spinal alignment', 'injury prevention'],
      ['macronutrients', 'micronutrients', 'caloric intake', 'protein synthesis', 'meal prep', 'carbohydrate loading', 'glycemic index', 'supplements', 'hydration', 'electrolytes', 'dietary fiber', 'omega-3 fatty acids', 'vitamins', 'minerals', 'nutrient timing', 'metabolic rate', 'dietary restrictions', 'plant-based diet', 'paleo diet', 'ketogenic diet'],
      ['mind-body connection', 'meditation', 'visualization', 'stress reduction', 'focus techniques', 'positive affirmations', 'resilience', 'progressive muscle relaxation', 'biofeedback', 'self-talk', 'goal setting', 'mindfulness practice', 'mental toughness', 'relaxation techniques', 'cognitive flexibility', 'emotion regulation', 'mental endurance', 'sleep hygiene', 'neuroplasticity', 'holistic wellness'],
      ['agility', 'quickness', 'reaction time', 'sport-specific training', 'plyometrics', 'skill acquisition', 'muscle memory', 'endurance', 'balance', 'speed development', 'athletic conditioning', 'cross-training', 'competitive mindset', 'performance nutrition', 'sports psychology', 'video analysis', 'injury recovery', 'tactical training', 'athlete monitoring', 'periodization']
    ]
  },
  {
    id: 'tutor',
    weight: 1.5,
    clusters: [
      ['algebra', 'calculus', 'geometry', 'trigonometry', 'differential equations', 'linear algebra', 'probability', 'statistics', 'pre-calculus', 'mathematical modeling', 'functions', 'integrals', 'derivatives', 'vector calculus', 'numerical methods', 'matrix operations', 'mathematical proofs', 'combinatorics', 'set theory', 'complex numbers'],
      ['sentence structure', 'literary analysis', 'poetry', 'prose', 'grammar', 'vocabulary', 'essay writing', 'creative writing', 'rhetoric', 'linguistics', 'comprehension', 'phonetics', 'syntax', 'semantics', 'literary devices', 'narrative techniques', 'editing', 'thesis statement', 'argumentative essay', 'fiction'],
      ['biology', 'physics', 'chemistry', 'earth science', 'astronomy', 'ecosystems', 'genetics', 'thermodynamics', 'organic chemistry', 'inorganic chemistry', 'periodic table', 'cellular biology', 'quantum mechanics', 'forces and motion', 'scientific method', 'biochemistry', 'photosynthesis', 'ecosystem dynamics', 'geology', 'astronomical phenomena'],
      ['history', 'geography', 'economics', 'political science', 'sociology', 'anthropology', 'civics', 'cultural studies', 'global studies', 'government systems', 'historical events', 'social movements', 'international relations', 'democracy', 'human rights', 'archaeology', 'ethics', 'cultural heritage', 'historical interpretation', 'case studies'],
      ['test-taking strategies', 'time management', 'practice exams', 'SAT', 'ACT', 'GRE', 'GMAT', 'standardized testing', 'multiple-choice questions', 'essay questions', 'score improvement', 'review sessions', 'flashcards', 'study groups', 'critical thinking', 'mind mapping', 'active recall', 'mnemonics', 'reading comprehension', 'problem-solving'],
      ['note-taking', 'organization', 'goal setting', 'focus techniques', 'learning styles', 'active listening', 'research skills', 'time allocation', 'critical analysis', 'peer learning', 'SQ3R (Survey, Question, Read, Recite, Review)', 'Cornell Method', 'information retention', 'concentration', 'academic motivation', 'study planner', 'self-assessment', 'learning objectives', 'academic resilience', 'digital literacy']
    ]
  },
  {
    id: 'pastor',
    weight: 1.8,
    clusters: [
      ['doctrine', 'eschatology', 'atonement', 'exegesis', 'soteriology', 'ecclesiology', 'hermeneutics', 'trinity', 'covenant theology', 'dispensationalism', 'sanctification', 'justification', 'inspiration', 'revelation', 'theodicy', 'sacraments', 'predestination', 'apostolic', 'creed', 'incarnation', 'charismatics', 'omnipotence', 'omniscience', 'providence', 'divine attributes', 'asceticism', 'blasphemy', 'Christology', 'holiness', 'imago Dei'],
      ['Old Testament', 'New Testament', 'Pentateuch', 'Gospels', 'Epistles', 'apocrypha', 'septuagint', 'parables', 'psalms', 'prophecy', 'biblical archaeology', 'manuscript', 'canon', 'synoptic', 'translation', 'dead sea scrolls', 'historical context', 'scripture interpretation', 'biblical languages', 'textual criticism', 'patriarchs', 'wisdom literature', 'minor prophets', 'major prophets', 'apocalyptic literature'],
      ['reformation', 'early church', 'martyrs', 'patristics', 'council of Nicaea', 'great schism', 'revival movements', 'missionary work', 'monasticism', 'reformation leaders', 'Protestantism', 'Catholicism', 'Orthodoxy', 'denomination', 'Vatican councils', 'iconoclasm', 'church fathers', 'ecumenism', 'crusades', 'awakening', 'apostolic succession', 'heresy', 'anathema', 'creedal development', 'saints'],
      ['counseling', 'grief support', 'marriage counseling', 'spiritual guidance', 'visitation', 'pastoral ethics', 'confidentiality', 'emotional support', 'hospital ministry', 'bereavement', 'listening skills', 'life transitions', 'interpersonal skills', 'spiritual growth', 'support group', 'community engagement', 'conflict resolution', 'addiction support', 'mentor', 'youth ministry', 'chaplaincy', 'pastoral theology', 'prayer chain', 'pastoral visit', 'life coaching'],
      ['liturgy', 'sacraments', 'hymns', 'prayer', 'sermon', 'worship planning', 'communion', 'baptism', 'Eucharist', 'praise', 'worship leadership', 'service structure', 'seasonal themes', 'choir', 'music ministry', 'adoration', 'invocation', 'benediction', 'response readings', 'worship technology', 'call to worship', 'responsive reading', 'offertory', 'doxology', 'worship arts'],
      ['moral theology', 'social justice', 'bioethics', 'sexual ethics', 'just war theory', 'ethical dilemmas', 'stewardship', 'tithing', 'charity', 'integrity', 'value systems', 'conscience', 'virtues', 'commandments', 'absolution', 'duty ethics', 'moral conscience', 'moral decision-making', 'virtue ethics', 'ethical teachings', 'natural law', 'divine command theory', 'consequentialism', 'moral relativism', 'canon law']
    ]
  },
  {
    id: 'hype',
    weight: 1.4,
    clusters: [
      ['viral content', 'engagement rate', 'influencer marketing', 'content calendar', 'brand storytelling', 'visual content', 'user-generated content', 'hashtags', 'SEO', 'copywriting', 'audience analysis', 'content curation', 'video editing', 'graphic design', 'brand voice', 'long-form content', 'short-form content', 'blogging', 'content pillars', 'call to action'],
      ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok', 'Snapchat', 'YouTube', 'Pinterest', 'Reddit', 'Clubhouse', 'social listening', 'algorithm', 'live streaming', 'stories', 'reels', 'social media integration', 'platform analytics', 'subscription models', 'community building', 'direct messaging'],
      ['click-through rate', 'impressions', 'reach', 'conversion rate', 'bounce rate', 'traffic analysis', 'engagement metrics', 'key performance indicators', 'A/B testing', 'follower growth', 'data mining', 'sentiment analysis', 'trend analysis', 'social ROI', 'analytics dashboard', 'heatmaps', 'influencer analytics', 'social listening tools', 'audience segmentation', 'behavioral analytics'],
      ['pay-per-click', 'social ads', 'target audience', 'ad placement', 'remarketing', 'ad creatives', 'budget allocation', 'ad copy', 'sponsored content', 'native advertising', 'lead generation', 'conversion funnel', 'ad spend', 'media buying', 'impression share', 'audience targeting', 'campaign management', 'cost per acquisition', 'ad retargeting', 'banner ads'],
      ['customer feedback', 'reputation management', 'community guidelines', 'moderation', 'engagement strategy', 'social interaction', 'user loyalty', 'fan base', 'online forums', 'community events', 'brand advocates', 'crisis management', 'relationship building', 'community insights', 'networking events', 'public relations', 'member support', 'feedback loop', 'user engagement', 'membership growth'],
      ['influencer trends', 'content virality', 'emerging platforms', 'social media trends', 'innovation strategy', 'digital transformation', 'augmented reality', 'virtual reality', 'interactive content', 'meme culture', 'digital storytelling', 'AR filters', 'social VR', 'tech advancements', 'trend forecasting', 'innovation labs', 'creative disruption', 'future tech', 'early adoption', 'cutting-edge technology']
    ]
  },
  {
    id: 'bestie',
    weight: 1.2,
    clusters: [
      ['active listening', 'empathy', 'compassion', 'encouragement', 'emotional intelligence', 'validation', 'trust building', 'support system', 'positive reinforcement', 'confidentiality', 'stress relief', 'non-judgmental', 'reassurance', 'emotion sharing', 'emotional availability', 'positive vibes', 'prioritizing connection', 'vulnerability', 'strength acknowledgment', 'honesty'],
      ['movie nights', 'dining out', 'hiking', 'road trips', 'game night', 'concerts', 'brunch', 'karaoke', 'book club', 'shopping spree', 'coffee dates', 'travel adventures', 'festival outings', 'beach day', 'picnics', 'crafting sessions', 'sports events', 'cultural experiences', 'spa days', 'birthday celebrations'],
      ['texting', 'calling', 'video chats', 'memes', 'GIFs', 'social media interactions', 'inside jokes', 'group chats', 'emoji communication', 'snail mail', 'voice messages', 'photo sharing', 'storytelling', 'expressive communication', 'engagement', 'updates', 'checking in', 'facetiming', 'feedback loops', 'nurturing dialogue'],
      ['problem-solving', 'de-escalation', 'compromising', 'negotiation', 'mediation', 'finding common ground', 'peacekeeping', 'active resolution', 'understanding differences', 'apology', 'forgiveness', 'boundary setting', 'open discussions', 'rebuilding trust', 'mutual respect', 'agreement crafting', 'conflict awareness', 'listening to understand', 'patience', 'resolution strategies'],
      ['goal setting', 'motivation', 'accountability partner', 'life coaching', 'growth mindset', 'self-improvement', 'aspiration sharing', 'skill development', 'habit building', 'reflective listening', 'confidence building', 'encouraging challenges', 'adventure seeking', 'vision boarding', 'success celebration', 'mentoring', 'positive affirmations', 'life goals', 'achievement recognition', 'support in transitions'],
      ['nostalgia', 'memory making', 'adventure memories', 'shared milestones', 'laughter', 'traditions', 'cultural rituals', 'heritage sharing', 'family gatherings', 'childhood connections', 'bonding moments', 'sentimental journeys', 'historic moments', 'legacy conversations', 'time capsules', 'holiday celebrations', 'seasonal changes', 'life benchmarks', 'journey reflection', 'reminiscence']
    ]
  }
];

export const detectExpertSuggestion = (
  text: string, 
  currentId: string, 
  personas: PersonaConfig[]
): PersonaConfig | null => {
  const lower = text.toLowerCase();
  const cleanText = lower.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ');
  
  let bestMatch: { id: string, score: number } | null = null;

  EXPERT_CONTEXTS.forEach(config => {
    if (config.id === currentId) return;

    let totalScore = 0;
    
    config.clusters.forEach(cluster => {
      const matches = cluster.filter(keyword => {
        const hyphenated = keyword.replace(/\s+/g, '-');
        return lower.includes(keyword) || lower.includes(hyphenated);
      });
      
      if (matches.length >= 2) {
        totalScore += (Math.pow(matches.length, 1.5) * config.weight);
      }
    });

    if (totalScore > 0 && (!bestMatch || totalScore > bestMatch.score)) {
      bestMatch = { id: config.id, score: totalScore };
    }
  });

  if (bestMatch && bestMatch.score >= 5.0) {
    return personas.find(p => p.id === bestMatch!.id) || null;
  }
  
  return null;
};
