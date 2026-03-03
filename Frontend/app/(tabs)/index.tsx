import Welcome from '../../components/Client/Welcome/welcome';
import Login from '../../components/Client/DangNhap/login';
import Signup from '../../components/Client/DangKy/signup';
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/../components/Client/Welcome/welcome" />;
}
export {
  Welcome,
  Login,
  Signup,
};