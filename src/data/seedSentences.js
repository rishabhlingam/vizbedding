export const CATEGORY_TECH = 0;
export const CATEGORY_FOOD = 1;

export const SEED_ENTRIES = [
  { text: 'neural network model training', category: CATEGORY_TECH },
  { text: 'deep learning image classifier', category: CATEGORY_TECH },
  { text: 'transformer language model architecture', category: CATEGORY_TECH },
  { text: 'supervised machine learning pipeline', category: CATEGORY_TECH },
  { text: 'unsupervised clustering algorithm design', category: CATEGORY_TECH },
  { text: 'reinforcement learning agent optimization', category: CATEGORY_TECH },
  { text: 'computer vision object detection system', category: CATEGORY_TECH },
  { text: 'natural language processing pipeline', category: CATEGORY_TECH },
  { text: 'large scale data preprocessing workflow', category: CATEGORY_TECH },
  { text: 'artificial intelligence decision system', category: CATEGORY_TECH },
  { text: 'speech recognition neural network', category: CATEGORY_TECH },
  { text: 'predictive analytics model training', category: CATEGORY_TECH },
  { text: 'feature engineering for machine learning', category: CATEGORY_TECH },
  { text: 'gradient descent optimization process', category: CATEGORY_TECH },
  { text: 'model evaluation and validation metrics', category: CATEGORY_TECH },
  // { text: 'real time inference system deployment', category: CATEGORY_TECH },
  // { text: 'autonomous system control algorithm', category: CATEGORY_TECH },
  // { text: 'recommendation system model design', category: CATEGORY_TECH },
  // { text: 'anomaly detection using machine learning', category: CATEGORY_TECH },
  // { text: 'high dimensional data representation', category: CATEGORY_TECH },

  { text: 'italian pasta cooking recipe', category: CATEGORY_FOOD },
  { text: 'spicy indian curry preparation', category: CATEGORY_FOOD },
  { text: 'baking chocolate cake in oven', category: CATEGORY_FOOD },
  { text: 'grilled chicken barbecue dish', category: CATEGORY_FOOD },
  { text: 'sushi rolling technique preparation', category: CATEGORY_FOOD },
  { text: 'fresh vegetable salad dressing', category: CATEGORY_FOOD },
  { text: 'homemade pizza dough preparation', category: CATEGORY_FOOD },
  { text: 'frying crispy potato snacks', category: CATEGORY_FOOD },
  { text: 'slow cooked beef stew recipe', category: CATEGORY_FOOD },
  { text: 'making creamy mushroom soup', category: CATEGORY_FOOD },
  { text: 'chopping vegetables for stir fry', category: CATEGORY_FOOD },
  { text: 'boiling rice with spices', category: CATEGORY_FOOD },
  { text: 'preparing traditional breakfast meal', category: CATEGORY_FOOD },
  { text: 'roasting vegetables in oven', category: CATEGORY_FOOD },
  { text: 'making fruit smoothie blend', category: CATEGORY_FOOD },
  // { text: 'cooking seafood garlic butter dish', category: CATEGORY_FOOD },
  // { text: 'kneading dough for bread baking', category: CATEGORY_FOOD },
  // { text: 'preparing street food snacks', category: CATEGORY_FOOD },
  // { text: 'mixing ingredients for dessert', category: CATEGORY_FOOD },
  // { text: 'simmering sauce for pasta', category: CATEGORY_FOOD },
];

export const SEED_SENTENCES = SEED_ENTRIES.map((x) => x.text);
export const SEED_CATEGORIES = SEED_ENTRIES.map((x) => x.category);
