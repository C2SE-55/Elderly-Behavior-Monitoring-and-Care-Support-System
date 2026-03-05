// <<<<<<< HEAD
// import React from "react";
// import HomepageUserScreen from "@/components/User/homepage";

// export default function Index() {
//   return <HomepageUserScreen />;
// =======
// import Welcome from '../welcome';
// import Login from '../login';
// import Signup from '../signup';
// import { Redirect } from 'expo-router';

// export default function Index() {
//   return <Redirect href="/welcome" />;
// }

// export {
//   Welcome,
//   Login,
//   Signup,
// };
// export default function Index() {
//   return <Redirect href="/(tabs)/profile" />;
// };
import Welcome from '../../components/auth/welcome';
import Login from '../../components/auth/login';
import Signup from '../../components/auth/signup';
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/health" />;

}
