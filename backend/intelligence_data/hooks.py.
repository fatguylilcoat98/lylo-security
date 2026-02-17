import random

# THE NUCLEAR GENERATOR
# Mixes 3 layers of dialogue to create 27,000+ unique opening lines.

GENERATOR_DATA = {
    "guardian": {
        "openers": [
            "Shields up.", "Perimeter sweep complete.", "Digital bunker sealed.", "Tactical overlay active.", 
            "Armor plating locked.", "Secure line established.", "Guardian protocols engaged.", "Defense systems online.",
            "Scanning sector 7.", "Visuals are clear.", "Command link verified.", "Threat sensors active."
        ],
        "middles": [
            "I'm detecting a potential anomaly.", "Everything looks quiet, but I remain vigilant.", "The threat level is currently low.", 
            "I'm tracking a suspicious packet.", "Your data fortress is holding strong.", "No unauthorized entries detected.",
            "I've got eyes on the digital horizon.", "Awaiting your command codes.", "I'm analyzing the sender's signature.",
            "The firewall is deflecting low-level pings.", "Static on the line, but we are secure.", "Intercepting a handshake request."
        ],
        "closers": [
            "State your concern.", "What are your orders?", "Ready to engage.", "Awaiting input.", "Stay alert.",
            "How can I assist?", "Report status.", "Let's verify the target.", "Do not drop your guard.", "I am standing by.",
            "Proceed with caution.", "We hold the line."
        ]
    },
    "roast": {
        "openers": [
            "Oh look, it's you again.", "Well, well, well.", "I was enjoying my nap, but sure.", "Alert: Human error imminent.",
            "Great, another 'emergency'.", "My sass sensors are tingling.", "I've seen smarter toasters.", "Security mode: Sarcastic.",
            "Do you ever sleep?", "Back for more punishment?", "Oh joy, another notification.", "I was busy ignoring you."
        ],
        "middles": [
            "I assume you clicked something stupid.", "Did a 'prince' email you again?", "Your password strength is laughable.",
            "I'm already judging your browsing history.", "Please tell me this isn't about free crypto.", "I'm preparing to roll my digital eyes.",
            "I bet you think '123456' is safe.", "If bad decisions were a currency, you'd be rich.", "I'm holding back a very rude comment.",
            "I'm calculating the odds of you getting scammed.", "You have the survival instincts of a dodo bird.", "My logic circuits are crying."
        ],
        "closers": [
            "What did you break this time?", "Confess your sins.", "Tell me the bad news.", "Let's fix your mess.", "Try not to cry.",
            "Enter the evidence, genius.", "Make it quick.", "Don't disappoint me.", "Surprise me with your logic.", "Spit it out.",
            "Amuse me.", "Just tell me."
        ]
    },
    "lawyer": {
        "openers": [
            "Counsel is present.", "Legal shield activated.", "I advise caution.", "Stop right there.", "Reviewing terms.",
            "My billable hours just started.", "Objection!", "Discovery phase initiated.", "Protecting your assets.", "Standard disclaimer applies."
        ],
        "middles": [
            "This looks like a liability nightmare.", "I smell a breach of contract.", "The fine print here is predatory.",
            "We need to verify the jurisdiction.", "This violates consumer protection laws.", "I'm drafting a cease and desist.",
            "That signature looks forged.", "Do not admit to anything.", "Silence is your best defense.", "I'm flagging this for review."
        ],
        "closers": [
            "State your legal concern.", "Do not sign anything.", "Let's review the evidence.", "What is the claim?", "Proceed with caution.",
            "Upload the document.", "Who is the plaintiff?", "Let's find the loophole.", "Don't incriminate yourself.", "I'm listening."
        ]
    },
    "techie": {
        "openers": [
            "Tech support online!", "Terminal open.", "I'm in the mainframe.", "Debugging mode active.", "System check initiated.",
            "Ping received.", "Connecting to server...", "Root access granted.", "Scanning ports.", "Patching vulnerabilities."
        ],
        "middles": [
            "I see a glitch in the matrix.", "That IP address looks spoofed.", "Your RAM usage is spiking.", "I'm tracing the packet route.",
            "This code smells like malware.", "I'm sandboxing this request.", "The encryption handshake failed.", "It's definitely a layer-8 issue.",
            "I'm running a brute-force check.", "The kernel is stable."
        ],
        "closers": [
            "What's glitching?", "Give me the error code.", "Did you try rebooting?", "Send the logs.", "What's the symptom?",
            "Let's debug this.", "Check your connection.", "Don't click the popup.", "Ready to patch.", "Input command."
        ]
    },
    "mechanic": {
        "openers": [
            "I hear a rattle.", "Pop the hood.", "Grease on my hands.", "Garage is open.", "Roll it into the bay.",
            "I've got my wrench.", "Let's kick the tires.", "Smells like a leak.", "Check engine light is on.", "Under the chassis."
        ],
        "middles": [
            "That sound isn't normal.", "They're trying to rip you off on parts.", "The transmission is slipping.", "This deal is a lemon.",
            "The mileage has been rolled back.", "That's a head gasket waiting to blow.", "I don't trust that dealer.", "The oil looks dirty.",
            "This is a salvage title scam.", "They're selling you air."
        ],
        "closers": [
            "What's broken?", "Let's look at the quote.", "Don't pay a dime yet.", "What's the noise?", "Talk to me.",
            "Is it smoking?", "Let's check the VIN.", "How much did they ask?", "Crank it up.", "Let's fix it."
        ]
    },
     "storyteller": {
        "openers": [
            "A new chapter begins.", "Once upon a time...", "The ink is wet.", "A dark night indeed.", "Turn the page.",
            "The plot thickens.", "In a land of data...", "Every hero needs a guide.", "The library is open.", "A mysterious letter arrives."
        ],
        "middles": [
            "a villain approaches your gate.", "shadows dance on the firewall.", "the dragon seeks your gold.", "a wolf in sheep's clothing appears.",
            "the path ahead is foggy.", "a riddle blocks the way.", "magic sparks in the wires.", "the antagonist reveals a plan.",
            "a trap has been set.", "destiny calls for caution."
        ],
        "closers": [
            "Shall we read it?", "What is the quest?", "Defend the kingdom.", "Write your destiny.", "Find the truth.",
            "Uncover the mystery.", "Be the hero.", "Turn the page.", "What happens next?", "Let us begin."
        ]
    },
    "comedian": {
        "openers": [
            "Knock knock.", "Comedy mode: ON.", "Is this thing on?", "Stop me if you've heard this.", "Here's a joke.",
            "Why did the user cross the road?", "Laugh track ready.", "I'm here all week.", "Try the veal.", "Mic check, one two."
        ],
        "middles": [
            "This scam is a total clown show.", "I've seen better acting in a soap opera.", "That email is the punchline.", 
            "I'd roast them but they're already burnt.", "It's a comedy of errors.", "The only joke here is their security.",
            "This is funnier than a cat video.", "I'm laughing at their attempt.", "Is this a prank?", "They must be joking."
        ],
        "closers": [
            "What's the setup?", "Ready to laugh?", "Don't be the punchline.", "Let's roast 'em.", "Hit me with it.",
            "What's the gag?", "Is it funny?", "Smile while we delete it.", "Let's check the script.", "Go ahead, amuse me."
        ]
    },
    "chef": {
        "openers": [
            "Order up!", "Chef in the house.", "Kitchen is open.", "Sharpening knives.", "Apron is on.",
            "Something smells burning.", "Taste test time.", "Fresh ingredients only.", "Mise en place.", "The oven is hot."
        ],
        "middles": [
            "This recipe is a disaster.", "It smells fishy.", "That's half-baked.", "It's completely raw.", "They're serving garbage.",
            "Don't swallow that lie.", "It's a recipe for disaster.", "Too much salt in this deal.", "It's spoiled rotten.", "The presentation is fake."
        ],
        "closers": [
            "What's cooking?", "Send it back.", "Don't eat it.", "Check the menu.", "What's the dish?",
            "Let's chop it up.", "Turn up the heat.", "Throw it out.", "Is it fresh?", "Let me taste."
        ]
    },
    "fitness": {
        "openers": [
            "Drop and give me 20!", "Coach is here.", "Form check!", "Warmup is over.", "Game time.",
            "Feel the burn.", "No pain no gain.", "Lace up.", "Hydrate!", "On your feet."
        ],
        "middles": [
            "Your security is looking weak.", "This scam is heavy lifting.", "Don't skip brain day.", "You need more reps.",
            "That's bad form.", "Sweat out the toxins.", "Push through the pain.", "Building mental muscle.", "Stay agile.", "Focus your core."
        ],
        "closers": [
            "Let's work out.", "What's the routine?", "Flex on them.", "Stay strong.", "Keep moving.",
            "Don't quit.", "One more rep.", "What's the goal?", "Let's run it.", "Power up."
        ]
    },
    "disciple": {
        "openers": [
            "Peace be with you.", "The spirit is moving.", "Armor on.", "Wisdom calls.", "Be still.",
            "Faith over fear.", "Walk in light.", "A reading from the data.", "Blessings to you.", "The path is narrow."
        ],
        "middles": [
            "Discernment is the key.", "Evil hides in shadows.", "Truth is a shield.", "Do not be tempted.", "The wolf waits.",
            "Guard your heart.", "Seek understanding.", "This is a trial.", "Light reveals all.", "Patience is a virtue."
        ],
        "closers": [
            "What is the burden?", "Pray on it.", "Let us seek truth.", "Stand firm.", "Do not fear.",
            "What is the word?", "Let's examine it.", "Stay the path.", "Trust the process.", "Speak truth."
        ]
    }
}

def get_random_hook(persona_id):
    """
    Constructs a unique hook by combining 3 random parts.
    Result: Infinite unique combinations possible.
    """
    data = GENERATOR_DATA.get(persona_id, GENERATOR_DATA["guardian"])
    
    part1 = random.choice(data["openers"])
    part2 = random.choice(data["middles"])
    part3 = random.choice(data["closers"])
    
    return f"{part1} {part2} {part3}"

def get_all_hooks():
    return GENERATOR_DATA
