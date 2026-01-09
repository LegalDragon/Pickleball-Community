import { MapPin, Users, Award, Calendar } from 'lucide-react';

const Stats = () => {
  const stats = [
    {
      icon: MapPin,
      number: '1000+',
      label: 'Courts Listed',
      description: 'Find courts near you'
    },
    {
      icon: Users,
      number: '500+',
      label: 'Active Clubs',
      description: 'Join your community'
    },
    {
      icon: Award,
      number: '2500+',
      label: 'Certified Players',
      description: 'Peer-reviewed ratings'
    },
    {
      icon: Calendar,
      number: '100+',
      label: 'Monthly Events',
      description: 'Tournaments & socials'
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            The Growing Pickleball Community
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of players connecting, playing, and improving together
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4 group-hover:bg-green-200 transition-colors">
                <stat.icon className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-1">{stat.number}</div>
              <div className="text-lg font-semibold text-gray-700 mb-1">{stat.label}</div>
              <div className="text-sm text-gray-500">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
