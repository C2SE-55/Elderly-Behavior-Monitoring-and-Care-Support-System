import Welcome from '../../components/auth/welcome';
import Login from '../../components/auth/login';
import Signup from '../../components/auth/signup';
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/health" />;
}
export {
  Welcome,
  Login,
  Signup,
};