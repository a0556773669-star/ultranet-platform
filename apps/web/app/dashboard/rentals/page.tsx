import { redirect } from "next/navigation";

export default function RentalsHomePage() {
  redirect("/dashboard/rentals/manage");
}
