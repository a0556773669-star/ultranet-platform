import { canSeePersonalTab } from "./personal/actions";
import { DuxusTabsNav } from "./duxus-tabs-nav";

/**
 * סרגל הלשוניות של האזור. רכיב **שרת**, כדי שלשונית "משימות ליוני" לא תרונדר בכלל
 * למי שאין לו גישה אליה - הסתרה בצד הלקוח הייתה משאירה את קיומה גלוי במקור העמוד.
 */
export async function DuxusTabs() {
  return <DuxusTabsNav showPersonal={await canSeePersonalTab()} />;
}
