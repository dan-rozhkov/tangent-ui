/**
 * Shared demo media. Files live in `public/media/`, credits in `public/media/CREDITS.md`.
 * Portraits are 400 px squares; photos are 1600 px on the long side.
 */

export interface MediaPerson {
  id: string;
  name: string;
  role?: string;
  src: string;
}

export interface MediaPhoto {
  id: string;
  alt: string;
  src: string;
  width: number;
  height: number;
}

export const people = [
  { id: "emma-collins", name: "Emma Collins", role: "Product designer", src: "/media/people/emma-collins.jpg" },
  { id: "marcus-johnson", name: "Marcus Johnson", role: "Frontend engineer", src: "/media/people/marcus-johnson.jpg" },
  { id: "jasmine-brooks", name: "Jasmine Brooks", role: "Design lead", src: "/media/people/jasmine-brooks.jpg" },
  { id: "olivia-bennett", name: "Olivia Bennett", role: "Platform engineer", src: "/media/people/olivia-bennett.jpg" },
  { id: "sofia-ramirez", name: "Sofia Ramirez", role: "Operations lead", src: "/media/people/sofia-ramirez.jpg" },
  { id: "ryan-sullivan", name: "Ryan Sullivan", role: "Account executive", src: "/media/people/ryan-sullivan.jpg" },
  { id: "hannah-walsh", name: "Hannah Walsh", role: "Customer success", src: "/media/people/hannah-walsh.jpg" },
  { id: "chloe-nguyen", name: "Chloe Nguyen", role: "Data analyst", src: "/media/people/chloe-nguyen.jpg" },
  { id: "ava-mitchell", name: "Ava Mitchell", role: "Marketing manager", src: "/media/people/ava-mitchell.jpg" },
  { id: "daniel-kim", name: "Daniel Kim", role: "Backend engineer", src: "/media/people/daniel-kim.jpg" },
  { id: "jordan-reyes", name: "Jordan Reyes", role: "Support specialist", src: "/media/people/jordan-reyes.jpg" },
  { id: "mateo-alvarez", name: "Mateo Alvarez", role: "Mobile engineer", src: "/media/people/mateo-alvarez.jpg" },
  { id: "tyler-hayes", name: "Tyler Hayes", role: "Sales lead", src: "/media/people/tyler-hayes.jpg" },
  { id: "andre-williams", name: "Andre Williams", role: "Finance partner", src: "/media/people/andre-williams.jpg" },
  { id: "nathan-cole", name: "Nathan Cole", role: "Engineering manager", src: "/media/people/nathan-cole.jpg" },
  { id: "diane-foster", name: "Diane Foster", role: "Chief operating officer", src: "/media/people/diane-foster.jpg" },
] as const satisfies readonly MediaPerson[];

export const photos = [
  { id: "cane-chair", alt: "A dark wooden armchair with a woven cane back on a concrete floor against a white wall", src: "/media/photos/cane-chair.jpg", width: 1200, height: 1600 },
  { id: "desk-lamp", alt: "A brass desk lamp with a white glass shade beside a stack of books in window light", src: "/media/photos/desk-lamp.jpg", width: 1600, height: 900 },
  { id: "wool-blanket", alt: "Folded cream and caramel knit blankets stacked in soft light", src: "/media/photos/wool-blanket.jpg", width: 1067, height: 1600 },
  { id: "teapot", alt: "A carved clay teapot and cup stacked on a burlap cloth", src: "/media/photos/teapot.jpg", width: 1067, height: 1600 },
  { id: "espresso-cups", alt: "Two stoneware espresso cups on a pale stone table", src: "/media/photos/espresso-cups.jpg", width: 1067, height: 1600 },
  { id: "clay-vases", alt: "Two textured clay vases in blush and sage against a mottled wall", src: "/media/photos/clay-vases.jpg", width: 1600, height: 1066 },
  { id: "paper-lantern", alt: "Round white paper lanterns hanging at different heights in a dim room", src: "/media/photos/paper-lantern.jpg", width: 1067, height: 1600 },
  { id: "loft-living", alt: "A bright loft living room with a wooden staircase, grey sofa, and woven pouf", src: "/media/photos/loft-living.jpg", width: 1200, height: 1600 },
  { id: "plant-studio", alt: "A bright room full of trailing and potted plants beside a tall window and a leather sofa", src: "/media/photos/plant-studio.jpg", width: 1600, height: 1068 },
  { id: "studio-desk", alt: "A bare wooden desk with a small vase of flowers against a white panelled wall", src: "/media/photos/studio-desk.jpg", width: 1600, height: 1066 },
  { id: "window-nook", alt: "A sunlit reading corner with a wooden table, an open book, and a lamp beside tall windows", src: "/media/photos/window-nook.jpg", width: 1600, height: 1066 },
  { id: "attic-bedroom", alt: "A made bed under the pitched wooden beams of an attic bedroom", src: "/media/photos/attic-bedroom.jpg", width: 1067, height: 1600 },
  { id: "noodle-bar", alt: "A bowl of ramen on a mosaic-topped table in warm light", src: "/media/photos/noodle-bar.jpg", width: 1067, height: 1600 },
  { id: "coffee-bar", alt: "A cream espresso machine and bottles on a dark marble bar counter", src: "/media/photos/coffee-bar.jpg", width: 1600, height: 1066 },
  { id: "concrete-tower", alt: "A concrete tower with deep balconies rising into a blue sky", src: "/media/photos/concrete-tower.jpg", width: 1600, height: 1069 },
  { id: "spiral-stair", alt: "A white spiral staircase seen from below with pendant lights", src: "/media/photos/spiral-stair.jpg", width: 1600, height: 1066 },
  { id: "desert-house", alt: "A small modern house in front of red desert rocks and sand", src: "/media/photos/desert-house.jpg", width: 1600, height: 900 },
  { id: "pastel-arches", alt: "A long pink arcade of arches receding into the distance", src: "/media/photos/pastel-arches.jpg", width: 1200, height: 1600 },
  { id: "sand-dunes", alt: "Rippled sand dunes glowing under a low golden sun", src: "/media/photos/sand-dunes.jpg", width: 1600, height: 1200 },
  { id: "pine-forest", alt: "Pine trees emerging from drifting mist on a forested hillside", src: "/media/photos/pine-forest.jpg", width: 1067, height: 1600 },
  { id: "rocky-cove", alt: "A small sandy cove between rocky headlands under a clear sky", src: "/media/photos/rocky-cove.jpg", width: 1171, height: 1600 },
  { id: "misty-lake", alt: "A calm lake under a pink-streaked dusk sky with low mist over the hills", src: "/media/photos/misty-lake.jpg", width: 1200, height: 1600 },
  { id: "kyoto-street", alt: "A quiet stone-paved street lined with old wooden houses in Kyoto", src: "/media/photos/kyoto-street.jpg", width: 1600, height: 1069 },
  { id: "kyoto-temple", alt: "A wooden temple hall above green forest with the city of Kyoto beyond", src: "/media/photos/kyoto-temple.jpg", width: 1600, height: 900 },
  { id: "kyoto-rooftops", alt: "A five-storey pagoda rising above tiled rooftops in Kyoto", src: "/media/photos/kyoto-rooftops.jpg", width: 1201, height: 1600 },
  { id: "ramen-bowl", alt: "A bowl of noodles with halved eggs and chopsticks on a white table", src: "/media/photos/ramen-bowl.jpg", width: 1067, height: 1600 },
  { id: "sushi-counter", alt: "Gloved hands setting salmon rolls on a plate at a pale wooden counter", src: "/media/photos/sushi-counter.jpg", width: 1334, height: 1334 },
] as const satisfies readonly MediaPhoto[];

export type PersonId = (typeof people)[number]["id"];
export type PhotoId = (typeof photos)[number]["id"];

/** Looks up a person by id. */
export function person(id: PersonId): MediaPerson {
  return people.find(entry => entry.id === id)!;
}

/** Looks up a photo by id. */
export function photo(id: PhotoId): MediaPhoto {
  return photos.find(entry => entry.id === id)!;
}

/** Square 400 px avatar path for a person id, for `src` props. */
export const avatar = (id: PersonId) => person(id).src;

/** The first `count` people, for avatar stacks and lists. */
export const peopleSample = (count: number) => people.slice(0, count);
