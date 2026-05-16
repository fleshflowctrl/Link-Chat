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
    lighting: "warm yellow shop signage glow on her hair and shoulder, dark night background, slight motion blur from low shutter speed",
    capture: "iPhone snapshot, unedited, slight noise from low light, slight motion blur on edges",
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
    backdrop: "very dark blurred background with a single horizontal warm light streak across the frame, possibly a passing tram or car window, no detail visible",
    lighting: "extremely low warm tungsten light, deep shadows, slight motion blur, light streak smearing across",
    capture: "snapchat-style selfie, low light noise, slight motion blur, slightly grainy",
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
    camera: "regular phone snapshot from a meter away, framed waist up, slight tilt, soft blurred edges of frame",
    backdrop: "the Kiyomizu-dera temple in Kyoto with its iconic wooden stage and architecture, deep green forest, distant Kyoto cityscape, blue sky, tourists faintly visible on the temple deck",
    lighting: "bright sunny daylight, slight haze, soft shadow on her face",
    capture: "iPhone snapshot, unedited, soft blurred vignette around the edges",
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
