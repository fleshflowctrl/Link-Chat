/**
 * Scene templates for persona photo generation.
 *
 * Diffusion models will reproduce the prompt's framing and setting very
 * literally. If we always say "casual phone selfie at home, soft window
 * light", every photo for every persona looks like the same shot —
 * which is exactly what the operator hit ("alle achtergronden hetzelfde,
 * geen full-body, alleen selfies").
 *
 * Each template bundles:
 *   - scene     — wat ze doet, waar (free-form)
 *   - camera    — distance/angle/perspective for the model
 *   - backdrop  — visible background detail (varies the locations)
 *   - lighting  — mood lighting (varies the look)
 *   - capture   — capture-device feel (selfie vs friend's phone vs DSLR)
 *
 * The four "camera/backdrop/lighting/capture" axes replace the
 * previously hard-coded "casual phone selfie" tail in
 * buildPersonaPhotoPrompt, so every photo gets a different look.
 *
 * Categorisation: each template has a `kind` so callers can bias toward
 * face-forward shots when generating an avatar (recognizability) and
 * full-body / candid shots for gallery items.
 */

export type SceneTemplate = {
  scene: string;
  camera: string;
  backdrop: string;
  lighting: string;
  capture: string;
  /** Specific outfit for this shot. When present this OVERRIDES the
   * persona's `photo_style.style` anchor for this photo only — without
   * this, every gallery shot ends up with the same "denim jacket"
   * because the persona-level style locks the wardrobe. Each template
   * must specify its own outfit so a 3-photo gallery actually shows
   * three different outfits. Keep it concrete: "blue sundress with
   * thin straps", not "casual summer". */
  outfit: string;
  /** Specific pose / body language. Same reason as `outfit`: without
   * an explicit pose token diffusion keeps falling back to the same
   * arms-crossed shoulder shot. */
  pose: string;
  /** Avatar = mostly face visible. Gallery = wider / activity shot.
   * Mixed = either works. */
  kind: "avatar" | "gallery" | "mixed";
};

export const SCENE_TEMPLATES: readonly SceneTemplate[] = [
  // --- "Real Instagram-style" templates inspired by ordinary phone
  // photos: lens flares, sun glare, mid-action, looking-away. These
  // exist specifically to fight the "too AI / too perfect" failure mode
  // by anchoring on real-photo imperfections. -----------------------------
  {
    scene: "smalle Italiaanse stadsstraat 's avonds, weg van een uitgaansavond",
    camera: "regular phone snapshot full body from a few meters away, slight tilt, slightly overexposed face from streetlight",
    backdrop: "narrow old European street at night, warm yellow streetlight glow, dark stone wall and a closed wooden door, hint of an Italian flag",
    lighting: "harsh streetlight from behind/side, strong lens flare cutting across the face, dark shadow background",
    capture: "iPhone snapshot, unedited, visible streetlight lens flare across the frame",
    outfit: "sleeveless burgundy or wine-red top, regular dark jeans, simple silver wristwatch, hair loose past shoulders",
    pose: "standing relaxed on the sidewalk, arms loose at her sides, neutral half-smile, looking flatly at the camera not posing",
    kind: "gallery",
  },
  {
    scene: "stadszicht bij zonsondergang, even snel een foto laten maken",
    camera: "regular phone snapshot full body from a few meters away, taken by a friend, slight tilt",
    backdrop: "ordinary city intersection at sunset, palm trees, traffic lights, intensely orange and red overexposed sky",
    lighting: "low warm sunset light, blown-out orange sky, flat front lighting on her face from the camera direction",
    capture: "iPhone snapshot, unedited, oversaturated orange sky from phone HDR, sun-warmed skin tone",
    outfit: "oversized grey blazer over a plain black crop top, regular light blue jeans, small silver chain necklace, hands tucked in blazer pockets",
    pose: "standing on a crosswalk, hands in blazer pockets, slight squint from the sun, small relaxed smile, head turned slightly toward the camera",
    kind: "gallery",
  },
  {
    scene: "kleedkamer mirror selfie voordat ze de deur uitgaat",
    camera: "full body mirror selfie with phone clearly visible at face height, slightly tilted, three-quarter angle",
    backdrop: "ordinary home walk-in closet with shelves of clothes and bags, pale curtains, parquet floor",
    lighting: "plain bright indoor daylight from a window, slight shadow on the wall behind her",
    capture: "iPhone mirror selfie, unedited, phone reflection visible, normal phone camera quality",
    outfit: "fitted pink midi dress with side slit, small black quilted clutch held against her hip, simple black strappy heels, silver wristwatch",
    pose: "standing slightly turned to one side in front of the mirror, one knee bent slightly, free hand at her hip holding the clutch, looking down at the phone in her hand, soft smile",
    kind: "gallery",
  },
  {
    scene: "op een balkon met uitzicht op zee tijdens een vakantie",
    camera: "regular phone snapshot from a couple meters away, taken by a friend, three-quarter framing waist up",
    backdrop: "ordinary holiday balcony with horizontal metal railing, distant city houses on a hillside, ocean and palm tree visible",
    lighting: "harsh midday sun, slightly blown highlights on shoulders and chest, deep shadow under chin, strong directional sunlight",
    capture: "iPhone snapshot, unedited, slightly washed out, sunlit",
    outfit: "small red triangle bikini top, leopard-print sarong tied around the hips, layered thin gold necklaces, simple bracelets, no extras",
    pose: "standing at the balcony railing, one hand resting at her hip on the sarong, eyes slightly squinted from the sun, casual real-life smile, hair lightly windblown",
    kind: "gallery",
  },
  {
    scene: "rondsnuffelen op een vintage kledingmarkt op een zonnige zaterdag",
    camera: "regular phone snapshot from a meter away, three-quarter framing, slightly low angle",
    backdrop: "outdoor market with racks of vintage jackets behind her, brick city buildings in the background, blue sky with thin clouds",
    lighting: "bright direct sunlight, sharp shadow on the ground, harsh contrast on her face",
    capture: "iPhone snapshot, unedited, harsh sunny phone exposure",
    outfit: "cropped brown leather bomber jacket over a black top, baggy washed dark jeans, fluffy black-and-white cow-print shoulder bag, black rectangular sunglasses",
    pose: "both hands lifted to the back of her head adjusting her hair, head turned slightly to the side, sunglasses on, mouth slightly open, mid-action not posed",
    kind: "gallery",
  },
  {
    scene: "even op een zonnige trap in de zuidelijke Europese zon",
    camera: "regular phone snapshot from below, taken from a step lower, full body framing, slightly tilted",
    backdrop: "ordinary outdoor stone staircase with whitewashed wall on one side and hand-painted green and yellow ceramic tiles on the other",
    lighting: "bright direct overhead sun, sharp leg shadow on the steps, slight squint",
    capture: "iPhone snapshot, unedited, sunny phone exposure",
    outfit: "short fitted black mini dress with one diagonal strap, small dark logo-pattern shoulder bag, knee-high black leather boots",
    pose: "standing on a step turned slightly toward the camera, one hand holding sunglasses against her thigh, head slightly tilted, soft smile while looking down at the camera",
    kind: "gallery",
  },
  {
    scene: "wandeling door het herfstbos, even achterom kijken",
    camera: "regular phone snapshot from behind, full body, taken from a few meters back",
    backdrop: "ordinary autumn forest path with fallen yellow and brown leaves, tall bare trees on either side",
    lighting: "soft diffused autumn daylight, no harsh shadows",
    capture: "iPhone snapshot, unedited",
    outfit: "cropped striped white-and-blue oxford shirt over a black bralette, high-waisted light-wash wide jeans, plain white sneakers, sunglasses held in one hand",
    pose: "captured mid-step from behind, head turned over the shoulder back at the camera, half-smile, sunglasses dangling from one hand, the other hand at her hip",
    kind: "gallery",
  },
  {
    scene: "lunch op een terras tijdens een vakantie, glas wijn in de hand",
    camera: "regular phone snapshot from across the table, taken by the person opposite, framed waist up at slight downward angle",
    backdrop: "ordinary southern European restaurant balcony with painted blue window frames behind, potted flowers, hint of another building across the alley",
    lighting: "warm afternoon daylight from the side, slightly blown highlights through the window, soft shadow on the table",
    capture: "iPhone snapshot, unedited, table set with cutlery and a small dish in the foreground",
    outfit: "thin-strap red square-neck sundress, layered thin gold necklaces, small white quilted handbag visible on the table, no makeup or very minimal",
    pose: "sitting at the table holding a wine glass loosely up by the stem, head tilted slightly to the side, slight squint from the light, real candid smile not posed for the camera",
    kind: "gallery",
  },
  {
    scene: "snelle nachtfoto bij een bar of cafe, ergens in de stad",
    camera: "regular phone snapshot from a meter away, full body, slightly low angle, slight tilt",
    backdrop: "ordinary city street at night, warm yellow shop sign behind her, parked bicycles, dark cobblestones",
    lighting: "warm yellow shop signage glow on her hair and shoulder, dark night background, slightly grainy from low light",
    capture: "iPhone snapshot, unedited, slight noise from low light, everything in focus end to end",
    outfit: "oversized black blazer worn over a short black mini dress, sheer black tights, knee-high black leather boots, small thin necklace",
    pose: "standing leaning a hand on a low metal railing or bike rack, ankles slightly crossed, neutral half-smile, looking forward at the camera, candid not posed",
    kind: "gallery",
  },
  {
    scene: "snelle thuis-mirror selfie voor het slapengaan",
    camera: "full body mirror selfie with phone clearly visible at chest height, slightly off-center",
    backdrop: "ordinary bedroom mirror, unmade bed visible in the reflection, normal closet door",
    lighting: "plain warm bedroom overhead light, slightly yellow cast",
    capture: "iPhone mirror selfie, unedited, phone reflection in frame",
    outfit: "plain oversized white t-shirt and grey shorts or boxer briefs, fluffy socks, hair in a messy bun, no makeup",
    pose: "standing front-facing in the mirror, phone held at chest with both hands, free thumb tapping the screen, neutral tired expression, no smile",
    kind: "gallery",
  },
  {
    scene: "een snelle eet-foto thuis, gewoon laten zien wat ze maakte",
    camera: "regular phone snapshot from above, slight downward angle, framed at chest with the food and her face visible",
    backdrop: "ordinary kitchen counter or small table, normal home in the background, no plating styling",
    lighting: "plain warm overhead kitchen light, slightly yellow",
    capture: "iPhone snapshot, unedited, slightly grainy",
    outfit: "plain oversized hoodie, hair scraped back, no makeup, small earrings",
    pose: "leaning over a plate of food held in one hand, other hand giving a small thumbs up, looking up at the camera with mouth slightly open mid-bite",
    kind: "gallery",
  },
  {
    scene: "zomeravond op de stoep voor de deur, even snel een foto",
    camera: "regular phone snapshot full body from a meter away, slightly low angle, off-center framing",
    backdrop: "ordinary residential street, parked cars, small front yard with hedge, evening sky",
    lighting: "soft fading evening light, long shadow on the pavement, warm tones",
    capture: "iPhone snapshot, unedited, slight grain",
    outfit: "plain white tank top and washed denim shorts, simple sneakers, small silver pendant necklace",
    pose: "standing slightly turned to the side, one foot crossed over the other, both hands at her sides, looking past the camera with a relaxed half-smile",
    kind: "gallery",
  },
  // --- Batch 2: 26 templates from a new round of reference photos ----------
  {
    scene: "snelle mirror selfie in de openbare wc tijdens een avondje uit",
    camera: "half-body mirror selfie with phone clearly visible at chest height, slightly off-center, plain head-on framing",
    backdrop: "ordinary public restroom with grey tile walls, white paper towel dispenser on the left, fluorescent ceiling light visible above, second mirror reflection in the background, sinks visible behind",
    lighting: "bright cool overhead fluorescent restroom light, slightly washed out",
    capture: "iPhone mirror selfie in a public bathroom, unedited, normal phone quality",
    outfit: "oversized black wool blazer, sleek dark high ponytail, small black structured handbag held against the stomach, simple gold ring on the index finger",
    pose: "standing front-facing in the mirror, both hands holding the phone at chest height with the camera lens visible, looking down at the screen with a neutral concentrated expression, no smile",
    kind: "mixed",
  },
  {
    scene: "vakantie wandeling op een Grieks eiland tegen zonsondergang",
    camera: "regular phone snapshot from a few meters away, full body framing, slightly off-center, slight tilt",
    backdrop: "low rough stone wall in foreground, white-washed Mediterranean houses with palm trees on a hillside, water tanks on a rooftop, asphalt road and dry shrubs",
    lighting: "low warm golden hour sunset light from the side, long shadow stretching across the road, hair slightly backlit",
    capture: "iPhone snapshot, unedited, sun-warmed exposure",
    outfit: "white spaghetti-strap fitted ribbed maxi dress, black flat slide sandals, small woven black mesh bucket handbag held in one hand, dark hair slicked back",
    pose: "standing on the road in front of the stone wall, one hand raised to her forehead shielding her eyes from the sun, neutral squinting expression, weight on one leg",
    kind: "gallery",
  },
  {
    scene: "voor een restaurant in een zuidelijke stad, even pauze met de bougainville achter haar",
    camera: "regular phone snapshot from a meter away, three-quarter framing waist up, eye level",
    backdrop: "rustic plaster wall in cream and sage tones with a small ornate niche window, bright pink-red bougainvillea flowers spilling from above, red fire extinguisher and small potted plant in the background, dark cobblestones",
    lighting: "warm low restaurant ambient light, soft glow on her face, dark shadow on the wall",
    capture: "iPhone snapshot, unedited, warm low-light tones",
    outfit: "cream halter-neck maxi dress with low V neckline and a small bow tie at the chest, brown leather shoulder bag, gold hoop earrings, simple gold pendant necklace, long brown hair down",
    pose: "standing slightly turned, one hand playing with a strand of hair near her shoulder, soft genuine smile looking directly at the camera",
    kind: "mixed",
  },
  {
    scene: "even nippen aan een verse kokosnoot op het strand",
    camera: "close-up phone snapshot taken by a friend, head and shoulders fill the frame, slightly off-center",
    backdrop: "Caribbean beach with bright turquoise water, white sand, distant cliff with houses and palm trees, blue sky with a few small clouds, swimmers in the water far behind",
    lighting: "bright midday Caribbean sun, slight squint from the brightness, warm light on her hair",
    capture: "iPhone snapshot, unedited, slightly washed out highlights from the sun",
    outfit: "white open-knit crochet long-sleeve cover-up over a bikini, no makeup, slightly damp blonde-brown hair, tiny gold hoops",
    pose: "holding a fresh young coconut up to her mouth with both hands, lips wrapped around two yellow paper straws, eyes squinted with a teasing closed-mouth smile, eyes locked on the camera",
    kind: "avatar",
  },
  {
    scene: "even bij de paarden op de manege, kort moment voor het rijden",
    camera: "regular phone snapshot from a meter away, head and chest framing with the horses on either side",
    backdrop: "outdoor stable yard with sandy ground, a treeline behind, slightly grey overcast sky, hint of stable buildings",
    lighting: "soft diffused overcast daylight, no harsh shadows",
    capture: "iPhone snapshot by a friend, unedited",
    outfit: "black quilted gilet over a navy blue long-sleeved athletic top, long brown hair down loosely, no makeup or very minimal",
    pose: "snuggled between two horses, arms wrapped around the dark bay horse's neck on her right, head tilted gently against its forehead, the chestnut horse with a white blaze on her left, big genuine warm smile looking at the camera",
    kind: "avatar",
  },
  {
    scene: "etentje in een hotelrestaurant met een wijntje",
    camera: "regular phone snapshot from across the table, framed waist up at slight downward angle",
    backdrop: "warm hotel restaurant interior with a large impressionist floral painting on the wall behind, wooden Venetian blinds in an archway, brass wall sconce visible",
    lighting: "warm yellow wall sconce light, intimate dim restaurant glow",
    capture: "iPhone snapshot from across the table, unedited, warm tones",
    outfit: "white strapless tube top, gold hoop earrings, several stacked thin gold bracelets on the right wrist with a small charm bracelet, dark red manicured nails, dark wavy long hair down",
    pose: "sitting at the table holding a wine glass up by the bowl in her right hand, left hand resting elegantly under her chin, big genuine smile, eyes locked on the camera",
    kind: "avatar",
  },
  {
    scene: "lunch op een terras in het centrum van een Nederlands stadje",
    camera: "regular phone snapshot from across the table, framed shoulders up, slight tilt",
    backdrop: "ordinary Dutch terrace setting with a hanging flower basket of pink and purple flowers on a black lamppost, white facades with red roof tiles across the street, parked dining tables in the distance",
    lighting: "plain overcast daylight, slightly grey sky, soft shadows",
    capture: "iPhone snapshot, unedited, normal phone exposure",
    outfit: "dark blue oversized denim jacket worn loosely over a plain white t-shirt, gold hoop earrings, long brown hair with natural waves down past her shoulders, very minimal makeup",
    pose: "sitting at the terrace table holding a tall cocktail glass with mint leaves and a black straw up by the rim, big bright genuine laughing smile looking up at the camera",
    kind: "avatar",
  },
  {
    scene: "vakantieavond op een Spaans landgoed, even voor het diner",
    camera: "regular phone snapshot from a meter away, framed waist up, slightly low angle",
    backdrop: "Spanish countryside setting with olive trees and Mediterranean shrubs, hilly landscape, a paper lantern hanging from a tree, white plaster wall on the left, fading dusk sky",
    lighting: "soft warm golden hour fading light, slight backlight on the hair, slightly hazy",
    capture: "iPhone snapshot, unedited, warm exposure",
    outfit: "fitted white short-sleeve cap-sleeve crop top, dark colored shoulder bag with a chain strap, gold hoop earrings, long brown wavy windswept hair, light makeup",
    pose: "standing slightly turned, one finger pointing playfully toward the camera, soft closed-mouth smile, hair blown to one side by the wind",
    kind: "mixed",
  },
  {
    scene: "wandeling over de boulevard in Spanje vlak voor de schemering",
    camera: "regular phone snapshot from a few meters away, full body framing, slight angle",
    backdrop: "Spanish beach promenade with a low stone wall, three tall date palm trees, ocean horizon, evening sky in soft blue and pink, distant city on a hill, small kiosk visible",
    lighting: "soft dusk light, blue and pink sky, gentle warm side light",
    capture: "iPhone snapshot, unedited, dusk tones",
    outfit: "oversized black wool coat over a light blue denim crop tube top, sunglasses pushed up on the head as a hairband, long brown hair with caramel highlights, small black shoulder bag",
    pose: "standing slightly turned, peace sign with two fingers raised next to her face, big bright genuine smile, other hand resting at her hip",
    kind: "gallery",
  },
  {
    scene: "snapchat-selfie laat op de avond, slaperig en ongelijnd",
    camera: "very close phone selfie, face fills the frame, slight tilt, dim",
    backdrop: "very dark background with a single horizontal warm light streak across the frame, possibly a passing tram or car window, no detail visible because of the dim light",
    lighting: "extremely low warm tungsten light, deep shadows, single bright light streak across",
    capture: "snapchat-style selfie, low light noise, slightly grainy, everything in focus",
    outfit: "dark warm-toned oversized sweater, frizzy slightly messy blonde hair, no visible makeup, no jewellery",
    pose: "face only, one hand raised near her hair touching it absent-mindedly, eyes half-lidded, slight pout, looking flatly at the camera, sleepy expression",
    kind: "avatar",
  },
  {
    scene: "zwart-wit mirror selfie in haar slaapkamer voor het raam",
    camera: "full body mirror selfie with phone visible at face height, slightly off-center, head-on framing",
    backdrop: "bedroom in black and white, two large windows showing trees outside, white curtain pulled to one side, window sill with a hairdryer and small items, plain wall",
    lighting: "soft natural daylight from the windows, monochrome black-and-white photo",
    capture: "iPhone mirror selfie with vintage black-and-white filter, unedited otherwise, normal phone quality",
    outfit: "white sheer ruffled blouse with multiple small bow ties down the front and balloon sleeves with cuff ties, light blue high-waisted skinny jeans, silver chain choker, hair down with soft waves, small earrings",
    pose: "standing front-facing in the mirror, one hand holding the phone up at face height, the other hand tucked into a front jean pocket, neutral cool expression looking past the phone at the camera",
    kind: "gallery",
  },
  {
    scene: "even zonnen in de tuin met een tongetje uit",
    camera: "close-up phone selfie from above looking down, face and chest fill the frame, slightly off-center",
    backdrop: "out-of-focus pink and white towel and grass beyond the body, hint of bare feet far below",
    lighting: "harsh direct overhead summer sun, deep shadow on the face from her own hand, blown highlights on shoulders and chest, very bright",
    capture: "iPhone selfie from above lying on a towel, unedited, slightly washed out highlights from the sun",
    outfit: "white triangle bikini top with bright orange straps, layered thin gold necklaces, gold watch with a thin band on the wrist, single white AirPod visible in the ear, no makeup, scattered blonde hair",
    pose: "lying on her back on a towel in the grass, one hand raised above her face shielding from the sun, tongue stuck out playfully, big eyes looking up at the camera, very tan skin",
    kind: "avatar",
  },
  {
    scene: "snelle nachtfoto bij de Eiffeltoren met een gek bekkie",
    camera: "regular phone snapshot from the side, framed shoulders up, slight tilt",
    backdrop: "Eiffel Tower fully lit up in golden light at night, the Seine river with boats and reflections, dark Parisian cityscape with hints of monument lights",
    lighting: "warm tower light glow on her side profile, deep dark surroundings, slight noise from low light",
    capture: "iPhone snapshot, unedited, slight low-light noise",
    outfit: "dark brown faux-leather biker jacket, beige knit scarf, tortoiseshell rectangular glasses, sleek high blonde ponytail pulled tight, small earrings",
    pose: "side profile turned slightly toward the camera, lips puckered in a playful kiss face, eyes squeezed closed, hair pulled back tightly, no smile",
    kind: "avatar",
  },
  {
    scene: "wandeling met de hond, snelle pov-foto naar beneden",
    camera: "phone POV looking straight down at her own outfit and the dog, slight tilt, no face visible",
    backdrop: "pavement with dappled sunlight and tree-shadow patterns, small white fluffy dog mid-step on a blue leash, hint of dry leaves",
    lighting: "bright sunny day with sharp dappled shade through trees, high contrast on the ground",
    capture: "iPhone POV snapshot looking down, candid casual",
    outfit: "fitted sage-green knee-length skirt, brown snakeskin-print leather cross-body bag with brown straps, white chunky sneakers, several thin gold bracelets on the wrist, no top visible from this angle",
    pose: "shot from her own POV looking down, only one leg visible mid-step, free hand holding the phone, the dog walking ahead pulling slightly on the leash",
    kind: "gallery",
  },
  {
    scene: "snelle thuis-mirror selfie tussen de tandpasta en deodorant",
    camera: "half-body mirror selfie with phone clearly visible at chest height, household clutter in foreground, slightly off-center",
    backdrop: "ordinary home bathroom, shelves of toiletries in the foreground (toothpaste tube, axe spray can, hair styling product, small first-aid box with a red cross sign, mouthwash, contact lens fluid, asthma inhaler in a pink case), heart-shaped mirror frame edge visible, small towel hanging",
    lighting: "warm bathroom overhead light, slightly yellow cast",
    capture: "iPhone mirror selfie at home, unedited, normal phone quality",
    outfit: "black blazer thrown over a pink lace satin V-neck cami, gold hoop earrings, simple thin gold necklace, sleek high ponytail, ash-blonde hair",
    pose: "standing in front of the mirror, phone held up at chest with the right hand, left hand at her side, looking sideways down at the screen with a focused expression, no smile",
    kind: "mixed",
  },
  {
    scene: "zonsondergang op het strand met een glaasje wijn op een zitzak",
    camera: "regular phone snapshot from the side, framed waist up with a low table in the foreground",
    backdrop: "tropical beach at sunset with white sand, ocean horizon, sun about to set with intense orange and pink sky, beach bar with hanging string lights overhead, other people on beanbags out of focus, sneakers tossed in the sand",
    lighting: "warm golden hour sunset, side-back lit, contre-jour with rim light on the hair",
    capture: "iPhone snapshot from the side, unedited, slightly grainy from low light",
    outfit: "fitted black ribbed tank top, dark denim shorts, hair tied back in a low loose ponytail, simple small earrings, smartphone visible on the table",
    pose: "sitting cross-legged on a tan beanbag at a low round table, side profile facing the sea, holding a red wine glass up by the bowl, looking out at the horizon thoughtfully, beer bottle and another wine glass on the table",
    kind: "gallery",
  },
  {
    scene: "snel even een mirror selfie tussen twee oefeningen door in de sportschool",
    camera: "full body mirror selfie at three-quarter angle, phone visible at face height, slightly off-center",
    backdrop: "modern gym with weight machines in the background, large floor-to-ceiling window showing forest outside, fluorescent ceiling lights, grey rubber tile floor, white sneakers tossed off to the side",
    lighting: "cool fluorescent gym lighting, slightly bluish, sharp on the body",
    capture: "iPhone mirror selfie in a gym, unedited",
    outfit: "fitted black sports tank, black mid-thigh biker shorts, white crew socks, sleek low blonde ponytail, fitness watch on the wrist, no makeup",
    pose: "standing front-facing toward the mirror, phone held at face height with the right hand showing the lens, holding an orange water bottle in the left hand, athletic stance with weight on one leg, neutral concentrated expression, no smile",
    kind: "gallery",
  },
  {
    scene: "schommelend boven de rijstvelden in Bali, vanaf achteren gefotografeerd",
    camera: "regular phone snapshot from behind, full body in motion, taken from a few meters back",
    backdrop: "panoramic view of bright green Balinese rice terraces, palm trees, distant volcano, hazy blue sky, far paddy fields and a small road below",
    lighting: "bright midday tropical sun, hazy atmosphere, slight haze on the distant hills",
    capture: "iPhone snapshot from behind, unedited",
    outfit: "lime yellow ribbed sleeveless crop tank top, loose white shorts, white chunky sneakers, low blonde ponytail, small earrings",
    pose: "viewed from behind, sitting on a wooden swing seat with thick hemp ropes, mid-swing with both arms thrown out wide for balance, no face visible",
    kind: "gallery",
  },
  {
    scene: "stadstrip Sevilla, snelle foto bij Plaza de España",
    camera: "regular phone snapshot from a few meters away, full body framing slightly off-center",
    backdrop: "Plaza de España in Sevilla with the iconic red brick tower and Moorish arches, canal with rowing boats, tiled balustrade with painted ceramic tiles, ornate columns, blue sunny sky, trees in the distance",
    lighting: "bright sunny daylight, slight harsh contrast, light hazy sky",
    capture: "iPhone snapshot taken by a friend, unedited",
    outfit: "fitted bright yellow knee-length sleeveless dress with a rounded neckline, white canvas tote bag over the shoulder, thin bracelets, long blonde hair down, soft pink lipstick",
    pose: "standing slightly turned leaning against the tiled balustrade, big genuine smile, free hand at her side",
    kind: "gallery",
  },
  {
    scene: "Tokyo dakterras 's avonds met de skyline op de achtergrond",
    camera: "regular phone snapshot from a meter away, full body, slight low angle",
    backdrop: "Tokyo night skyline with modern skyscrapers, one office tower with windows lit up, one skyscraper with a bright pink-magenta neon top, lower buildings and street, dark sky with thin clouds, dark wooden balcony fencing in the foreground",
    lighting: "cool urban night light, ambient glow from the city, slight blue cast",
    capture: "iPhone snapshot from the side, unedited, slight low-light noise",
    outfit: "long burgundy paisley print wrap dress with a high front slit revealing the leg and a deep V neckline, knee-high tan suede heeled boots, gold layered necklaces, long brown wavy hair, fuller evening makeup",
    pose: "sitting/leaning against the rooftop wooden railing, one leg bent up resting on the lower rail, the other leg straight down, dress slit open showing the thigh, both hands resting on the railing, looking slightly off camera with a smirk",
    kind: "gallery",
  },
  {
    scene: "stadstrip Kyoto bij de Kiyomizu-dera tempel",
    camera: "regular phone snapshot from a meter away, framed waist up, slight tilt",
    backdrop: "the Kiyomizu-dera temple in Kyoto with its iconic wooden stage and architecture, deep green forest, distant Kyoto cityscape, blue sky, tourists faintly visible on the temple deck",
    lighting: "bright sunny daylight, slight haze, soft shadow on her face",
    capture: "iPhone snapshot, unedited, everything in focus from foreground to background",
    outfit: "fitted red short-sleeve V-neck button-up blouse with small gold buttons, black skirt with subtle red floral print, red shoulder bag, long dark hair down with side-swept bangs, small stud earrings",
    pose: "leaning gently with one hand on a wooden railing, the other hand at her side, soft closed-mouth smile, head slightly tilted toward the camera",
    kind: "mixed",
  },
  {
    scene: "snelle fit-check vanaf bovenaf, geen gezicht in beeld",
    camera: "phone POV looking straight down at her own outfit, full body but face hidden by the hood of her hoodie, slight tilt",
    backdrop: "light wood laminate floor, black and white striped doormat at the bottom of the frame, stack of clothes in the upper corner of the frame",
    lighting: "plain warm indoor light, slight shadow under the body",
    capture: "iPhone mirror selfie shot looking down at the floor, unedited",
    outfit: "black graphic hoodie with a bold yellow logo across the chest visible mirrored, low-rise washed light blue baggy boyfriend jeans showing a white branded boxer waistband peeking above, black low-top sneakers, small black leather chain-strap shoulder bag with buckles dangling from the hand",
    pose: "standing looking straight down at her own outfit, head tilted down so the face is fully hidden by the hood and hair, holding the chain strap of the bag so it dangles in front of her thighs",
    kind: "gallery",
  },
  {
    scene: "snelle warme mirror selfie thuis voor het uitgaan",
    camera: "full body mirror selfie with phone visible at face height, doorway frame around the mirror, slightly off-center",
    backdrop: "bedroom doorway with mustard yellow walls, side mirror in the archway, bed inside with floral patterned bedding and small throw pillows, painted wall art with a sun motif",
    lighting: "very warm orange incandescent bulbs, deeply warm cast across the whole scene, slight shadow on the wall",
    capture: "iPhone mirror selfie at home, unedited, very warm orange tones",
    outfit: "long fitted bodycon spaghetti-strap maxi dress with a black background and a large red and orange tomato or fruit pattern, barefoot, dark hair tied back, dark plum lipstick, small earrings",
    pose: "standing front-facing in the mirror in the doorway, one hand holding the phone up at face level, the other hand at her hip on the dress, slight closed pout, looking down at the screen",
    kind: "gallery",
  },
  {
    scene: "kleedhokje van een kledingwinkel, even iets passen",
    camera: "half-body mirror selfie with phone clearly visible at face height, slightly off-center",
    backdrop: "clothing store fitting room, hanging clothes including a leopard-print fur coat and blue jeans on a rack to the left, white curtain pulled to the side, beige curtain on the right",
    lighting: "indoor store fluorescent light, slight glow from the phone screen",
    capture: "iPhone fitting-room mirror selfie, unedited, slight phone screen glow",
    outfit: "black long-sleeve fitted basic top, distressed light wash high-waisted skinny jeans with a rip at the hip showing bare skin, bright copper-red curly shoulder-length hair, no makeup",
    pose: "standing facing the mirror, phone held at face height with the right hand, free hand tucked into the front jean pocket, neutral expression behind the phone, eyes on the camera",
    kind: "mixed",
  },
  {
    scene: "lui in bed op de luipaardprintdeken, snelle selfie",
    camera: "close-up phone selfie from above lying down, face and chest fill the frame",
    backdrop: "leopard cheetah print fluffy throw or sheet beneath her, hint of pillow under the head",
    lighting: "warm soft bedroom light, gentle on the face",
    capture: "iPhone selfie from above lying down, unedited",
    outfit: "black ribbed tank top, long brown wavy ombre hair fanned out around her, soft full glam makeup with lipgloss, small gold star pendant necklace, several thin bracelets including a beaded one, long manicured nails",
    pose: "lying on her back on the leopard-print sheet, hand resting near her face and neck with bracelets visible, soft genuine flirty closed-mouth smile, eyes locked on the camera, hair fanning out around her",
    kind: "avatar",
  },
  {
    scene: "boerderijbezoek, even een koe aaien door het hek",
    camera: "regular phone snapshot from the side by a friend, framed three-quarter from waist up",
    backdrop: "farm scene with a metal barred fence in the foreground, green grass field behind the cows, treeline in the distance, two cows visible (one black-and-white Holstein with a yellow ear tag, another dark cow behind), bright outdoor setting",
    lighting: "bright sunny midday daylight, slight harsh shadow on the side of the face",
    capture: "iPhone snapshot from the side, unedited, sunny exposure",
    outfit: "white short-sleeve dress with small dark green and black floral print, sunglasses pushed up on the head as a headband, smartwatch on the wrist, copper red curly long hair",
    pose: "standing in side profile facing the cow, both hands reaching gently through the metal fence to touch the cow's nose, calm engaged expression looking at the cow not the camera, soft small smile",
    kind: "gallery",
  },
  // --- Batch 3: 45 templates from the next round of reference photos.
  // Heavy mix of mature women (40s-60s) and varied scenarios. ---------
  {
    scene: "snelle thuis-selfie aan de werkplek, op een rustige doordeweekse middag",
    camera: "phone selfie front camera, head and shoulders fill the frame, slight tilt",
    backdrop: "ordinary home interior with a small framed art print of a deer, a wall calendar, and a window with greenery visible outside, neutral wall",
    lighting: "soft natural daylight from the window on one side, warm indoor tones",
    capture: "iPhone selfie, unedited, normal phone quality",
    outfit: "plain black turtleneck, hair pulled into a high ponytail with a few loose strands at the sides, simple stud earrings, soft natural makeup with a subtle nude lipstick",
    pose: "head turned slightly toward the camera with a warm genuine smile, eyes locked on the camera, no pose, just hanging out at home",
    kind: "avatar",
  },
  {
    scene: "snelle uitgaans mirror selfie in de hal voor de deur",
    camera: "full body mirror selfie with phone visible at chest height, slightly off-center, eye level",
    backdrop: "ordinary home hallway with a plain white wall and white door, beige tile floor, hint of a staircase",
    lighting: "plain warm indoor light, slight shadow on the wall behind",
    capture: "iPhone mirror selfie, unedited",
    outfit: "fitted black long-sleeve top with a sheer lace neckline, long open ribbed cardigan over the top, dark grey jeans, pointed black ankle boots with a small heel, smartwatch and a few thin rings, dark red manicured nails",
    pose: "standing front-facing, weight on one leg, phone held up at chest with both hands showing a small smile from behind it",
    kind: "gallery",
  },
  {
    scene: "snelle fit-check mirror selfie tussen de deur en de gang",
    camera: "full body mirror selfie with phone covering most of the face, slightly off-center",
    backdrop: "ordinary home doorway, plain white walls and dark door frame, parquet or laminate floor",
    lighting: "plain bright indoor daylight, slight shadow on the wall",
    capture: "iPhone mirror selfie, unedited",
    outfit: "fitted grey heathered ribbed tank crop top showing a slim toned midriff, light wash baggy boyfriend jeans loosely sitting on the hips, layered thin gold bracelets, small earrings, hair in a half-up clip",
    pose: "standing slightly turned, free hand reaching out to a black door handle to one side, phone held at face height with the other hand, casual unposed",
    kind: "gallery",
  },
  {
    scene: "even een lach gevangen tijdens een rustig moment thuis",
    camera: "phone selfie from a meter away or slightly closer, head and shoulders fill the frame",
    backdrop: "plain beige or cream painted wall behind, hint of a soft cast shadow",
    lighting: "warm indoor light from the side, sharp shadow on the wall behind, slightly hard contrast on the face",
    capture: "iPhone snapshot, unedited",
    outfit: "fitted black sleeveless mock-neck top, no jewellery or very minimal, hair down with soft waves",
    pose: "head turned in three-quarter view away from the camera with a big genuine laughing smile, eyes squinted slightly, mouth open, mid-action not posed",
    kind: "avatar",
  },
  {
    scene: "intieme zwart-wit selfie laat in de avond",
    camera: "close-up phone selfie, head and shoulders fill the frame",
    backdrop: "dim indoor background in black and white, hint of curtains and a newspaper visible behind, no clear detail",
    lighting: "soft warm side lamp light converted to monochrome, gentle shadow on one side of the face",
    capture: "iPhone selfie with a black-and-white filter, unedited otherwise",
    outfit: "long dark hair flowing over the shoulders, small stud earrings, plain dark sleeveless top, no makeup or very minimal, small natural beauty mark visible",
    pose: "head facing forward, soft closed-mouth Mona-Lisa smile, eyes locked on the camera, calm relaxed expression",
    kind: "avatar",
  },
  {
    scene: "snelle thuisselfie waarbij ze speels haar haar omhoog gooit",
    camera: "phone selfie front camera, head and chest fill the frame",
    backdrop: "ordinary home interior, plain wall, hint of a small framed picture",
    lighting: "warm indoor light, soft glow on the face",
    capture: "iPhone selfie, unedited",
    outfit: "black sheer lace neckline top, gold drop chandelier earrings, smartwatch on the wrist, soft natural makeup with rosy lipgloss, light brown hair with caramel highlights",
    pose: "one hand lifted and gathering all her long hair to the side of her head, other hand holding the phone, big bright genuine smile looking at the camera",
    kind: "avatar",
  },
  {
    scene: "scheef gehouden mirror selfie voor het uitgaan met vlechten in",
    camera: "tilted full body mirror selfie with phone clearly visible at face height, frame strongly tilted to one side",
    backdrop: "ordinary home interior with messy clutter visible behind, suitcases, bags, kids items on the floor, plain white wall",
    lighting: "plain bright indoor daylight from a window, slight shadow on the wall",
    capture: "iPhone mirror selfie, unedited, deliberately tilted angle",
    outfit: "fitted royal blue bodycon mini dress with thin spaghetti straps and a small floral neckline detail, long blonde hair in a single side braid down the chest, gold pendant necklace, thin gold bracelets, black strappy heels, freshly tanned skin",
    pose: "standing slightly turned with one leg crossed in front of the other, free hand resting on a white shelf to the side, phone held up at face height, soft pout looking at the screen",
    kind: "gallery",
  },
  {
    scene: "even gefotografeerd thuis met een gestyled hoekje achter haar",
    camera: "regular phone snapshot from a meter away, full body framing, slight angle",
    backdrop: "ordinary home corner styled with a tall white wooden decorative ladder draped with cream paper flowers and a small woven basket, plain white wall, parquet floor",
    lighting: "plain warm indoor light, soft glow",
    capture: "iPhone snapshot by a friend, unedited",
    outfit: "peach and cream tropical floral print blazer with notch lapels, plain white tank top underneath, distressed white skinny jeans with multiple rips at the knees and thighs, nude pointed pumps, long blonde wavy hair, French-tip nails",
    pose: "kneeling on one knee on the floor next to the decorative ladder, one hand resting on her bent knee, the other hand at her side, soft relaxed closed-mouth smile looking at the camera",
    kind: "gallery",
  },
  {
    scene: "intieme thuisselfie met een lichtbundel die over haar gezicht valt",
    camera: "close-up phone selfie, head and shoulders fill the frame",
    backdrop: "dim home interior with grey curtains pulled to one side, plain wall with a hint of a framed picture",
    lighting: "low warm tungsten light with a single bright sunbeam streak cutting diagonally across her cheek and chest, sharp contrast",
    capture: "iPhone selfie, unedited, slight light streak from the window",
    outfit: "long jet-black hair flowing over the shoulders, plain black sleeveless top, simple silver stud earrings, no makeup or very minimal, naturally tanned skin",
    pose: "head facing forward, calm relaxed closed-mouth small smile, eyes softly locked on the camera, no posing",
    kind: "avatar",
  },
  {
    scene: "etentje in een hippe wijnbar met een cocktail in de hand",
    camera: "regular phone snapshot from across the table, framed waist up at slight downward angle",
    backdrop: "modern wine bar interior with a backlit floor-to-ceiling glass wine wall full of bottles, dark wood and dim leather booth, hint of a waiter walking past, white round table with a small dessert visible",
    lighting: "warm dim restaurant ambient light, soft glow on her shoulders, dark surroundings",
    capture: "iPhone snapshot from across the table, unedited, low light grain",
    outfit: "black off-the-shoulder cocktail dress with dramatic puff sleeves and a deep sweetheart neckline, thin gold pendant necklace, small hoop earrings, soft fuller evening makeup with eyeliner and rosy lipstick, long brown wavy hair tossed to one side",
    pose: "sitting at the booth holding a coupe glass with a creamy yellow whiskey sour cocktail, looking down at the cocktail with a soft genuine smile, head slightly tilted, no eye contact with the camera",
    kind: "avatar",
  },
  {
    scene: "snelle avondselfie buiten op straat tijdens een Spaanse vakantie",
    camera: "close-up phone selfie, head and chest fill the frame, slight tilt",
    backdrop: "ordinary Spanish street with light grey paving tiles, hint of a palm tree and dry shrubs in the background",
    lighting: "soft warm evening light, slight backlight on the hair",
    capture: "iPhone selfie, unedited, sunny exposure",
    outfit: "fitted leopard print sleeveless top, layered thin gold necklaces, small gold hoop earrings, single black wireless earbud visible in the ear, long jet-black hair with a few highlights, soft fuller evening makeup",
    pose: "head turned slightly to the side with a big bright genuine smile, eyes happily on the camera, hair slightly windblown",
    kind: "avatar",
  },
  {
    scene: "even op een design-stoel in de lobby van een hotel",
    camera: "regular phone snapshot from a meter away, full body framing, slight low angle",
    backdrop: "luxurious modern hotel lobby with warm wood-clad walls, ambient orange-amber lighting, a black leather Barcelona chair and matching footstool on a plush dark grey rug, glass coffee table with a candle, indoor olive tree in a planter",
    lighting: "warm low ambient hotel lighting, soft glow on her face, deep shadows in the background",
    capture: "iPhone snapshot, unedited, slight grain from low light",
    outfit: "black strapless top with a sculpted petal neckline, fitted black trousers, chunky white-and-black sneakers worn casually, tiny silver hoop earrings, hair pulled back into a loose low bun",
    pose: "sitting on the Barcelona chair with one leg crossed over the other, hands resting in her lap, head tilted slightly with a closed-mouth smile, looking off to the side not the camera",
    kind: "gallery",
  },
  {
    scene: "snelle pas-mirror selfie in een boutique kleedhokje",
    camera: "full body mirror selfie with phone clearly visible at face height, slightly off-center",
    backdrop: "boutique fitting room with raw plywood plank walls, beige curtain pulled to one side, hint of a small bench and her shoes off in the corner",
    lighting: "indoor store ceiling spotlight, slight shadow on the floor",
    capture: "iPhone fitting-room mirror selfie, unedited",
    outfit: "fitted dark navy ribbed sleeveless mock-neck top, dark acid-wash denim shorts cuffed at the hem, athletic toned legs, simple silver-and-gold earrings stack, gold bracelet, smartwatch, red manicured nails",
    pose: "standing front-facing in the mirror, phone held at face height with the right hand showing the lens, free hand pinching the hem of her shorts, head tilted slightly with a focused expression",
    kind: "gallery",
  },
  {
    scene: "thuis op de bank met de kat naast haar, gewone middag",
    camera: "regular phone snapshot from a meter away, full body framing, slight angle",
    backdrop: "cosy living room with a tweed grey couch, decorative cushions with cat-print pattern, beige wall with white wood paneling, vintage Persian rug on the floor",
    lighting: "warm indoor light, soft side glow on the couch",
    capture: "iPhone snapshot, unedited, slightly warm tones",
    outfit: "fitted black sleeveless A-line mini dress, ankle-tied black espadrille wedge sandals, simple silver stud earrings, long jet-black hair down, soft natural makeup",
    pose: "sitting on the couch with legs crossed at the knees, one hand gently petting a small grey tabby cat curled up next to her, the other hand resting near her chin, head tilted with a soft closed-mouth smile looking at the camera",
    kind: "gallery",
  },
  {
    scene: "even ontspannen in de sauna na een lange dag",
    camera: "regular phone snapshot from a couple meters away by a friend, full body framing, slightly low angle",
    backdrop: "wooden Finnish-style sauna interior, light pine wood plank walls and benches, small wood-paneled ceiling lamp, no people or steam",
    lighting: "warm wood-toned ambient sauna light, soft glow on skin",
    capture: "iPhone snapshot, unedited, normal indoor exposure",
    outfit: "wrapped in a plain white spa towel covering the chest down to mid-thigh, hair tied up in a low loose bun, simple stud earrings, slim silver wristwatch, dark plum nail polish, no makeup",
    pose: "sitting on the lower wooden bench with one leg bent up against her body and the other extended across the bench, one hand resting on her knee, the other resting on her thigh, calm relaxed expression looking off to the side",
    kind: "gallery",
  },
  {
    scene: "passend pas-mirror selfie in een hippe boutique",
    camera: "half-body mirror selfie with phone visible at chest, slightly off-center",
    backdrop: "boutique interior with light pink walls, white wood-paneled walls, parquet floor, salon-style chair behind, racks of clothing visible, ceiling fan",
    lighting: "plain bright indoor daylight, soft glow",
    capture: "iPhone mirror selfie, unedited",
    outfit: "fitted white floral mini dress with thin spaghetti straps and small blue flower print, ruched bodice, small black leather crossbody bag worn over one shoulder, long blonde wavy hair, no makeup",
    pose: "standing slightly turned, free hand resting on the back of a chair next to her, phone held up at face height with the right hand, soft genuine smile while looking down at the screen",
    kind: "gallery",
  },
  {
    scene: "rustige koffieselfie aan tafel thuis",
    camera: "phone selfie close-up, head fills the frame, slightly tilted",
    backdrop: "plain white kitchen wall behind, hint of wooden table edge, neutral home setting",
    lighting: "soft warm window daylight from the side",
    capture: "iPhone selfie, unedited",
    outfit: "fitted black blouse with sheer plaid texture, thin silver chain necklace with a small pendant, soft natural makeup, long blonde wavy hair down",
    pose: "holding a chunky cream ceramic mug up to her mouth with both hands, taking a sip with the mug slightly covering her lips and nose, eyes locked on the camera over the rim with a small smile in the eyes",
    kind: "avatar",
  },
  {
    scene: "snelle pas-selfie in een glitterjurk in het kleedhokje",
    camera: "phone selfie head and shoulders fill the frame, slight tilt, intimate close-up",
    backdrop: "fitting room with plain white wall and dark curtain on one side, beige carpet visible at the bottom",
    lighting: "warm indoor spotlight from above, soft glow on the face",
    capture: "iPhone selfie, unedited, slight grain",
    outfit: "fitted dark champagne sparkly halter cocktail dress with a deep V-neckline and twisted bodice, large gold hoop earrings, soft fuller evening makeup with bold eyeliner and dark plum lipstick, shoulder-length wavy hair with caramel highlights",
    pose: "head turned slightly to the side with a closed-mouth confident pout, eyes locked intensely on the camera, free hand at her side, no full smile",
    kind: "mixed",
  },
  {
    scene: "spelend op een opblaasbare unicorn in het zwembad",
    camera: "regular phone snapshot from a meter away, full body framing, slight low angle",
    backdrop: "outdoor pool deck with bright blue water, large inflatable rainbow unicorn floatie in the pool, wooden deck and beach chairs visible, other guests faintly in the background, white pool bar in the distance",
    lighting: "bright midday summer sun, sharp reflections on the water, slight squint from the brightness",
    capture: "iPhone snapshot, unedited, sunny exposure",
    outfit: "fitted plain black bikini, hair tied up in a high ponytail with messy strands, slight bracelet on the wrist, no makeup, sunkissed tan skin",
    pose: "kneeling on top of the unicorn floatie with hands gripping the inflatable wings, body slightly turned to the side, looking forward, candid balance pose",
    kind: "gallery",
  },
  {
    scene: "snelle uitgaans mirror selfie voor een ornament-spiegel",
    camera: "full body mirror selfie with phone visible at face height, slightly off-center",
    backdrop: "ornate gold baroque-frame full-length mirror, plain cream-coloured hallway behind, beige carpet floor, hint of a closed door",
    lighting: "warm indoor light, soft glow on the dress, slight shadow behind",
    capture: "iPhone mirror selfie, unedited",
    outfit: "short black lace dress with high mock-neck and short sleeves, scalloped hem, sheer black tights, cream suede ankle cowboy boots with a small heel, long blonde wavy hair down",
    pose: "standing front-facing in the mirror, weight on one leg, phone held up at face height with one hand, soft closed-mouth smile while looking down at the screen",
    kind: "gallery",
  },
  {
    scene: "vakantiefoto bij de zee, even op de rotsen aan een Spaans eiland",
    camera: "regular phone snapshot from a meter away by a friend, full body framing, slight angle",
    backdrop: "rocky coastline with dark volcanic black and beige rocks, vivid turquoise sea behind, distant blue mountains on the horizon, blue sky with thin clouds, hint of the wind in the hair",
    lighting: "bright sunny midday, slight haze, deep cool blue tones in the water, sun warming the skin",
    capture: "iPhone snapshot, unedited, sunny exposure",
    outfit: "thin-strap white-with-mint-green floral print mini sundress, dark sunglasses, layered thin gold necklaces, small black quilted handbag at her side, hair down with sun-bleached blonde tones",
    pose: "sitting on a large rock with legs crossed at the knees, one hand resting on her thigh, other arm visible at her side, soft closed-mouth smile looking at the camera, hair slightly windblown",
    kind: "gallery",
  },
  {
    scene: "vakantieselfie onder een boom op een tropisch eiland",
    camera: "close-up phone selfie, head and shoulders fill the frame",
    backdrop: "ordinary tropical beach with white sand, ocean horizon with small boats and red flags, a low palm-shaped tree with bare branches behind, beach chairs faintly visible",
    lighting: "bright sunny day, slight squint from the brightness, soft warm tones",
    capture: "iPhone selfie, unedited, sunny exposure",
    outfit: "deep red triangle bikini top with a hint of white pattern at the neckline, large dark cat-eye sunglasses, long blonde hair down with sun highlights, simple thin necklace, sun-warmed glowing skin with freckles",
    pose: "head facing forward with a soft closed-mouth confident smile, sunglasses covering the eyes, hair slightly windblown",
    kind: "avatar",
  },
  {
    scene: "boottochtje, snelle selfie met reddingsvest aan",
    camera: "phone selfie close-up at a low angle, head and shoulders fill the frame",
    backdrop: "open ocean with bright shallow turquoise water, sunlight reflecting on the surface, hint of the boat hull and a railing in the foreground",
    lighting: "bright midday sun, sharp reflections on the water below, sunglasses block the eyes",
    capture: "iPhone selfie, unedited, sunny exposure with slight wind",
    outfit: "bright orange life-jacket vest worn over a thin floral sundress, dark rectangular sunglasses, blue paper wristband on the wrist, thin silver pendant necklace, hair pulled back into a low messy ponytail, no makeup",
    pose: "leaning forward over the boat railing, one hand visible holding a strap, head facing the camera with a small closed-mouth smile, slight squint from the bright sun",
    kind: "avatar",
  },
  {
    scene: "boven op een berg bij zonsondergang in Madeira",
    camera: "regular phone snapshot from a meter back, full body in silhouette, taken by a friend",
    backdrop: "high mountain ridge with rocky path and dry grass, panoramic view over a sea of clouds with mountain peaks poking through, low orange-yellow sun setting on the horizon, faint silhouettes of other hikers sitting nearby",
    lighting: "low warm sunset light directly ahead, subject mostly in silhouette, golden glow on the clouds",
    capture: "iPhone snapshot, unedited, contre-jour against the sun",
    outfit: "oversized black sweatshirt or fleece, plain black athletic leggings, hiking sneakers, hair tied up in a low messy bun, no jewellery visible from this distance",
    pose: "viewed from behind, standing on the rocky ridge looking out at the sunset, weight on one leg, hands tucked into the front pouch of the hoodie, calm contemplative pose",
    kind: "gallery",
  },
  {
    scene: "vakantiefoto bij het Lions Dive resort op Curaçao 's avonds",
    camera: "regular phone snapshot from a couple meters away, full body framing, slight low angle",
    backdrop: "outdoor resort entrance with a large carved white stone lion statue on a base reading Lions Dive Beach Resort Curacao, dark wooden deck floor, palm trees and beach behind, evening blue tropical light",
    lighting: "warm low resort lights from below highlighting the lion, dark blue evening sky, sharp directional flash on her face",
    capture: "iPhone snapshot, unedited, slight low-light noise",
    outfit: "fitted leopard-print midi tube dress with a sweetheart neckline, gold metallic platform sandals, gold beige tote bag over one shoulder, layered gold necklaces and stacked bracelets, long jet-black hair down, soft fuller evening makeup with bold eyeliner",
    pose: "leaning casually with one hip against the lion statue base, one hand resting on the statue, the other hand at her side flashing a relaxed peace sign, big bright genuine smile looking at the camera",
    kind: "gallery",
  },
  {
    scene: "snelle strandselfie onder de palmenparasol op een zonnige dag",
    camera: "phone selfie head and shoulders fill the frame",
    backdrop: "ordinary tropical beach setting with two thatched-straw beach umbrellas behind, blue and white striped beach chairs, ocean horizon visible, other beachgoers faintly visible",
    lighting: "bright midday sun, slight squint, blown highlights on the hair",
    capture: "iPhone selfie, unedited, sunny exposure",
    outfit: "thin-strap purple bikini top, layered gold charm necklace with small pendants, large oversized dark square sunglasses, long sun-bleached blonde hair down, freckled skin",
    pose: "head facing forward with a small soft closed-mouth smile, sunglasses covering the eyes, head slightly tilted to one side, hair slightly windblown",
    kind: "avatar",
  },
  {
    scene: "thuisselfie aan tafel in de woonkamer op een doordeweekse middag",
    camera: "phone selfie close-up, head and chest fill the frame, slight tilt",
    backdrop: "ordinary modern home interior with a wooden dining table, a few items on the table, plant in the background, neutral wall",
    lighting: "soft natural daylight from a window, warm tones on the face",
    capture: "iPhone selfie, unedited",
    outfit: "fitted grey heathered ribbed knit top with a black open cardigan over it, gold pendant chain necklace with a small bee charm, soft natural makeup with blue-toned eyeliner, shoulder-length blonde hair tucked back",
    pose: "head facing forward with a calm soft closed-mouth smile, eyes locked warmly on the camera, no posing",
    kind: "avatar",
  },
  {
    scene: "snelle thuisselfie in de woonkamer op een lui weekend",
    camera: "phone selfie at slightly low angle, head and chest fill the frame",
    backdrop: "ordinary modern home interior with parquet herringbone floor, white sideboard with a small JBL bluetooth speaker, candle, and tall green plant in the background",
    lighting: "soft warm window daylight, slight glow on the skin",
    capture: "iPhone selfie, unedited",
    outfit: "fitted soft pink ribbed cropped tank top, light wash baggy boyfriend jeans loosely buttoned at the hip, thin silver chain necklace with a small charm, no makeup or very minimal, shoulder-length blonde hair down",
    pose: "standing slightly turned, free hand tugging at the waistband of the jeans low on her hip, soft closed-mouth Mona-Lisa smile looking down at the camera, casual unposed",
    kind: "avatar",
  },
  {
    scene: "vakantiefoto bij Wat Arun-tempel in Bangkok",
    camera: "regular phone snapshot from a meter away, three-quarter body framing, slight low angle",
    backdrop: "white-and-grey ornate Wat Arun temple spire towering above with intricate stone carvings, blue Thai ceramic flower decorations on the foreground wall, overcast grey sky behind",
    lighting: "soft overcast daylight, gentle even tones",
    capture: "iPhone snapshot taken by a friend, unedited",
    outfit: "loose black long-sleeve modest top respecting temple etiquette, mustard-yellow wide-leg trousers with a knotted scarf detail at one ankle, thin silver chain necklace, small earrings, hair tied up in a loose bun",
    pose: "sitting on a low ornate ledge in side profile, looking up and away at the temple with a soft thoughtful expression, hands resting in her lap, no eye contact with the camera",
    kind: "gallery",
  },
  {
    scene: "intieme bovenkamer-selfie op de bank, half tegen het kussen",
    camera: "close-up phone selfie at a low angle, head and chest fill the frame, slightly tilted",
    backdrop: "warm dark home interior with a brown velvet couch and a yellow accent cushion behind her",
    lighting: "soft warm afternoon window light from the side, glowy on the cheek",
    capture: "iPhone selfie, unedited, slight warm tone",
    outfit: "fitted deep burgundy ribbed long-sleeve top with a deep V-neckline and small ruffle trim, layered thin gold chain necklaces, soft natural makeup with rosy lipgloss, long blonde wavy hair down with caramel highlights",
    pose: "leaning back slightly into the couch with one hand under her chin, fingers framing her jawline, soft closed-mouth confident smile, eyes locked on the camera",
    kind: "avatar",
  },
  {
    scene: "ochtendkoffie op een terras in Centraal-Amerika op vakantie",
    camera: "regular phone snapshot from across the table, framed waist up at slight angle",
    backdrop: "outdoor terrace cafe with a wooden plank table, red lattice railing, tropical garden with palm and banana plants behind, hint of mountains and corrugated metal roof",
    lighting: "soft overcast daylight, gentle warm tones",
    capture: "iPhone snapshot from across the table, unedited",
    outfit: "oversized grey textured bomber jacket with a zebra-striped tote bag over one shoulder, white t-shirt underneath, layered colourful charm bracelets on the wrist, simple stud earrings, no makeup, shoulder-length sun-bleached blonde hair",
    pose: "sitting at the table holding a small ceramic mug with both hands at chin level, head tilted slightly with a big bright genuine smile, eyes locked happily on the camera",
    kind: "gallery",
  },
  {
    scene: "snelle auto-selfie op weg naar buiten in de winter",
    camera: "phone selfie close-up in the driver seat, head and shoulders fill the frame, slight tilt",
    backdrop: "ordinary car interior with grey fabric headrest, hint of rear seat and side window in the background, snowy outdoor light",
    lighting: "soft cool daylight from the windscreen, slight glow on the cheek",
    capture: "iPhone selfie, unedited, slightly cool tones",
    outfit: "shiny burgundy puffer winter jacket with the high collar fully zipped up to the neck, small diamond stud earring, fastened seatbelt visible across the chest, soft natural makeup, shoulder-length blonde hair with subtle highlights",
    pose: "head facing forward with a soft closed-mouth genuine smile, eyes warmly on the camera, casual unposed",
    kind: "avatar",
  },
  {
    scene: "vakantiefoto bij een Maya-ruïne op Yucatán",
    camera: "regular phone snapshot from a meter back, three-quarter body framing, slight low angle",
    backdrop: "ancient Mayan stone ruin wall with weathered grey-and-beige limestone blocks behind, dry grass field at the bottom",
    lighting: "soft overcast warm daylight, no harsh shadows",
    capture: "iPhone snapshot taken by a friend, unedited",
    outfit: "wide-brim straw fedora hat with a small woven trim, plain white sleeveless tank top with a small front knot tie, dusty pink linen midi wrap skirt, thin gold pendant necklace, layered colourful charm bracelets on the wrist, small black-and-white zebra clutch in one hand, no makeup",
    pose: "standing front-facing in front of the wall, hands clasped softly in front of her at hip level, big bright genuine smile looking warmly at the camera",
    kind: "gallery",
  },
  {
    scene: "luie middagselfie op de bank in een huiselijk hoekje",
    camera: "phone selfie close-up, head and chest fill the frame",
    backdrop: "dim warm home interior with a brown velvet couch and a soft black blanket behind, no clear other detail",
    lighting: "warm soft side lamp light, glow on one side of the face",
    capture: "iPhone selfie, unedited, slight warm cast",
    outfit: "thin-strap black silky top, fine silver necklace with a small Aquarius pendant zodiac coin, no makeup or very minimal, sun-bleached blonde wavy hair down with messy texture, freckles visible across the chest and shoulders",
    pose: "leaning back into the couch in three-quarter view, one shoulder slightly forward, soft closed-mouth Mona-Lisa smile, eyes warm and locked on the camera, no posing",
    kind: "avatar",
  },
  {
    scene: "snelle bikiniselfie in de tuin onder de citroenboom",
    camera: "phone selfie close-up, head and chest fill the frame",
    backdrop: "Mediterranean villa garden with a small lemon tree heavy with yellow lemons just behind her, white painted decorative breeze-block wall, hint of green leaves",
    lighting: "bright sunny midday daylight, slight squint, sharp shadow on the wall behind",
    capture: "iPhone selfie, unedited, sunny exposure",
    outfit: "white halter bikini top with a small textured pattern, layered thin gold charm necklace with small coin pendants, large dark oversized square sunglasses, sun-bleached blonde wavy hair down, lots of freckles across the chest and shoulders",
    pose: "head facing forward with a calm closed-mouth small smile, sunglasses covering the eyes, head tilted slightly to one side, completely unposed",
    kind: "avatar",
  },
  {
    scene: "tropische park-selfie met een aapje op de schouder",
    camera: "phone selfie close-up, head and shoulders fill the frame, framed slightly to one side",
    backdrop: "tropical jungle park with green leafy trees and a bare staircase visible in the distance, light dappled forest shade",
    lighting: "soft dappled daylight filtered through the trees, slight squint",
    capture: "iPhone selfie taken on the move, unedited",
    outfit: "thin-strap dusty pink tank top, simple thin necklace, beige tote bag strap over one shoulder, sun-bleached blonde wavy hair down",
    pose: "small grey-and-tan macaque monkey perched on her shoulder eating something, her head tilted away from the monkey with a big laughing genuine smile and a slight wince of surprise, candid mid-action",
    kind: "avatar",
  },
  {
    scene: "topless even op de rotsen bij de zee in een afgelegen baai",
    camera: "regular phone snapshot from a few meters away by a friend, full body framing, low angle from below",
    backdrop: "secluded Mediterranean cove with rugged tan rocky cliffs rising up, deep green-blue calm sea below, distant pine trees on the cliffs, faint silhouette of a swimmer in the water",
    lighting: "bright morning sun, soft warm tones on the rocks, sun on her back",
    capture: "iPhone snapshot from a distance, unedited, sunny exposure",
    outfit: "topless with bare back facing the camera, plain dark olive bikini bottoms, long dark brown wavy hair pulled forward over one shoulder, no makeup",
    pose: "sitting on a flat rock ledge in three-quarter view from behind, knees bent up to her chest, one arm resting on her knee, looking out at the sea, no eye contact with the camera, contemplative",
    kind: "gallery",
  },
  {
    scene: "snelle pauze op een terras tijdens een sportdag",
    camera: "phone selfie close-up, head and shoulders fill the frame",
    backdrop: "outdoor sports field with green artificial turf and a faint white line, blurry-far group of people standing around with red and pink shirts, plastic cups of beer faintly visible at the bottom of the frame",
    lighting: "warm soft late-afternoon sunlight, golden hour glow",
    capture: "iPhone selfie, unedited, sunny exposure",
    outfit: "white short-sleeve broderie-anglaise blouse with small embroidery and tiny perforations, thin gold necklace with a small initial pendant, small gold hoop earrings, long blonde wavy hair down with sun highlights, soft natural makeup",
    pose: "head facing forward with a big bright genuine smile, eyes warmly on the camera, slight squint from the sun",
    kind: "avatar",
  },
  {
    scene: "snelle thuisselfie in een ruiteroutfit voor het naar buiten gaan",
    camera: "phone selfie close-up, head and chest fill the frame",
    backdrop: "ordinary modern home interior with parquet wood floor, white sideboard and a tall green plant in the background, neutral wall",
    lighting: "soft warm window daylight, glowy on the cheek",
    capture: "iPhone selfie, unedited",
    outfit: "fitted purple-blue quilted padded riding gilet with a small embroidered logo on the chest, half-zipped over a thin matching base layer turtleneck, layered thin gold necklaces, small earrings, soft fuller evening makeup with bold eyeliner, shoulder-length blonde hair with grey-blonde highlights",
    pose: "head facing forward with a big bright genuine smile, eyes locked happily on the camera, casual unposed",
    kind: "avatar",
  },
  {
    scene: "boottocht naar het Navagio Beach scheepswrak op Zakynthos",
    camera: "regular phone snapshot from behind, full body, taken by a friend on the boat",
    backdrop: "famous Navagio shipwreck beach in Greece with white sand, the rusted iron shipwreck visible on the sand, towering white limestone cliffs behind, vivid turquoise crystal clear shallow water in the foreground, hint of the boat railing and a chain",
    lighting: "bright sunny midday, sharp clear blue tones in the sea, soft shadows on the cliffs",
    capture: "iPhone snapshot from behind, unedited, sunny exposure",
    outfit: "loose flowy red-orange thin-strap mini sundress with a low V-shaped open back, sun-bleached blonde wavy hair down past the shoulders, no jewellery visible from this angle",
    pose: "viewed from behind, standing at the boat railing with both hands on the chain railings, looking out toward the shipwreck, no eye contact with the camera, hair slightly windblown",
    kind: "gallery",
  },
  {
    scene: "ritje door een kaal Nederlands bos op een Fjord-pony",
    camera: "regular phone snapshot from a meter back from the side, framed three-quarter body, slight low angle",
    backdrop: "winter forest with bare leafless trees and a thick brown leaf-littered ground, soft overcast daylight, no other riders visible",
    lighting: "soft overcast cool daylight, slight chilly tones",
    capture: "iPhone snapshot taken by a friend on the trail, unedited",
    outfit: "fitted black quilted padded riding jacket, plain black breeches, tall brown leather riding boots, black helmet, no jewellery visible, blonde hair tucked under the helmet",
    pose: "sitting on a stocky cream-and-blonde Fjord pony with a thick mane and bridle, head turned over her shoulder back toward the camera with a big bright genuine smile, the pony walking calmly through the forest",
    kind: "gallery",
  },
  {
    scene: "vakantiekiekje op het strand tussen de palmbomen op Yucatán",
    camera: "regular phone snapshot from a meter back, full body framing, slight low angle",
    backdrop: "Caribbean beach with bright white sand, tall slender palm trees behind, lush green low shrubs, hint of a thatched-roof palapa cabana in the background, blue sky",
    lighting: "bright sunny midday, sharp warm tones, slight squint from the brightness",
    capture: "iPhone snapshot taken by a friend, unedited, sunny exposure",
    outfit: "halter leopard-print tank top, light wash denim cut-off shorts, gold thong sandals, thin gold ankle bracelet, sun-bleached blonde long hair down, no jewellery on the neck",
    pose: "standing front-facing with both hands on her hips and feet shoulder-width apart, weight on one leg, head tilted slightly with a big bright genuine smile, eyes warmly on the camera",
    kind: "gallery",
  },
  {
    scene: "vakantiekiekje voor de Belém-toren in Lissabon",
    camera: "regular phone snapshot from a meter back, full body framing, slight low angle",
    backdrop: "the iconic Torre de Belém Manueline-style stone tower in Lisbon, with scaffolding visible at one side, Tagus river flowing past, blue sky with thin clouds, paved tile waterfront walkway and a steel safety fence in the foreground",
    lighting: "bright sunny midday, sharp warm tones",
    capture: "iPhone snapshot taken by a friend, unedited, sunny exposure",
    outfit: "thin-strap textured pastel-stripe knit cropped top with a small ruffle hem, light wash denim cut-off shorts cuffed at the hem, white sneakers, thin gold pendant necklace, soft fuller evening makeup with eyeliner, long blonde wavy hair slightly windblown",
    pose: "standing in front of the railing with both arms stretched out wide along the rail, weight on one leg, head turned slightly to the side with a small soft closed-mouth smile, hair slightly windblown",
    kind: "gallery",
  },
  {
    scene: "snelle stadsparkselfie op een doordeweekse middag",
    camera: "phone selfie close-up, head and shoulders fill the frame",
    backdrop: "tropical city park with low pond and lily pads, hint of high-rise apartment buildings far behind in soft haze, green tropical plants, wooden bridge",
    lighting: "soft overcast humid daylight, slight glow on the face",
    capture: "iPhone selfie, unedited",
    outfit: "fitted black sleeveless tank top with a small label, simple gold coin pendant necklace, small earrings, black backpack strap visible across the chest, sun-bleached blonde wavy hair down, freckles on the cheeks, no makeup",
    pose: "head facing forward with a big bright genuine smile and full teeth showing, eyes happily on the camera, casual hot-day glow on the skin",
    kind: "avatar",
  },
] as const;

function candidatesForSlot(slot: "avatar" | "gallery"): readonly SceneTemplate[] {
  if (slot === "gallery") return SCENE_TEMPLATES;
  // Avatar slot prefers face-forward "avatar" / "mixed" templates so
  // the profile photo stays recognisable. If the template list happens
  // to contain none of those (e.g. operator deleted all avatar
  // templates while curating a new set), gracefully fall back to the
  // full list so we never crash with an empty candidate array.
  const avatarLike = SCENE_TEMPLATES.filter(
    (t) => t.kind === "avatar" || t.kind === "mixed",
  );
  return avatarLike.length > 0 ? avatarLike : SCENE_TEMPLATES;
}

/** Pick a scene template.
 *
 * Two selection modes, picked by which arg the caller provides:
 *
 *   - `variant: number`  →  round-robin: `variant % candidates.length`.
 *     Use this in bulk-generate so a batch of N personas walks the
 *     template list in order (variant = batchOffset + index) and no
 *     two personas in the batch can land on the same template
 *     (assuming N ≤ candidates.length). This is the right behaviour
 *     for batches because hash-based selection still gets birthday-
 *     paradox collisions at 10/11.
 *
 *   - `variant` omitted   →  deterministic hash on `personaId|slot`.
 *     Use this in single-shot retries (edit page "regenerate") so the
 *     same persona always lands on the same template until the
 *     operator explicitly cycles. Different personas spread through
 *     the set via the hash.
 *
 * `slot` always restricts the candidate set: "avatar" filters to
 * face-forward shots so the profile photo is recognisable, "gallery"
 * uses the full list with full-body and activity shots. */
export function pickSceneTemplate(opts: {
  personaId: string;
  slot: "avatar" | "gallery";
  /** When provided: round-robin index (modulo'd by candidate count).
   * When omitted: hash on personaId. */
  variant?: number;
}): SceneTemplate {
  const candidates = candidatesForSlot(opts.slot);
  if (typeof opts.variant === "number" && Number.isFinite(opts.variant)) {
    const v = ((Math.floor(opts.variant) % candidates.length) + candidates.length) %
      candidates.length;
    return candidates[v]!;
  }
  // Hash on persona id alone — single-shot retries should map to the
  // same template until the operator bumps `variant`.
  const key = `${opts.personaId}|${opts.slot}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = (h >>> 0) % candidates.length;
  return candidates[idx]!;
}
