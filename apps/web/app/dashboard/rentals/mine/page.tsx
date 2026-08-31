import RentalsManagePage from "../manage/page";

export default async function MyRentalsPage() {
  return <RentalsManagePage searchParams={{ mine: "1" }} />;
}
