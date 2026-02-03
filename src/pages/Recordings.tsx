import { RecordingsLibrary } from '@/components/RecordingsLibrary';
import { useNavigate } from 'react-router-dom';

const Recordings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4">
        <RecordingsLibrary onBack={() => navigate(-1)} />
      </div>
    </div>
  );
};

export default Recordings;
