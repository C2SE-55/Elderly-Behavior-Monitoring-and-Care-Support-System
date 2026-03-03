import Welcome from '../welcome';
import Login from '../login';
import Signup from '../signup';
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/welcome" />;
}
export {
  Welcome,
  Login,
  Signup,
};