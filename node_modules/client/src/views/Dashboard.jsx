import AppLayout from "../components/layout/AppLayout.jsx";
import QuickActions from "../components/widgets/QuickActions.jsx";
import UpcomingTable from "../components/widgets/UpcomingTable.jsx";
import DeviceCheck from "../components/widgets/DeviceCheck.jsx";

export default function Dashboard(){
  return (
    <AppLayout active="dashboard">
      <div style={{display:"grid", gridTemplateColumns:"1.1fr .9fr", gap:"16px", marginBottom:"16px"}}>
        <QuickActions />
        <DeviceCheck />
      </div>
      <UpcomingTable />
    </AppLayout>
  );
}
