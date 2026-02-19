import { Button, View } from 'react-native';
import api from "../../api";

export default function Request() {
  const createRequest = async () => {
    await api.post('/service-request', {
      service_type: 'Corte',
      address: 'Casa cliente',
      latitude: 4.6,
      longitude: -74.08,
    });

    alert('Solicitud creada');
  };

  return (
    <View>
      <Button title="Solicitar servicio" onPress={createRequest} />
    </View>
  );
}