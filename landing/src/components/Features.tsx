import { useTranslation } from '@/i18n/TranslationContext';

export default function Features() {
  const { t } = useTranslation();

  const features = [
    {
      icon: '🎯',
      titleKey: 'features.autoFocus.title',
      descKey: 'features.autoFocus.description',
      gradient: 'from-[var(--sf-salmon)] to-[var(--sf-salmon-deep)]',
    },
    {
      icon: '🔄',
      titleKey: 'features.multiTask.title',
      descKey: 'features.multiTask.description',
      gradient: 'from-[var(--sf-wasabi)] to-[#5A7A4A]',
    },
    {
      icon: '🔌',
      titleKey: 'features.pluginIntegration.title',
      descKey: 'features.pluginIntegration.description',
      gradient: 'from-[var(--sf-gold)] to-[#A68B52]',
    },
  ];

  return (
    <section id="features" className="section">
      <div className="container">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="section-title mb-4">{t('features.title')}</h2>
          <p className="text-lg text-sf-text-secondary">{t('features.subtitle')}</p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card group fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div
                className={`card-icon bg-gradient-to-br ${feature.gradient}`}
                style={{ border: 'none' }}
              >
                <span className="text-xl filter drop-shadow-sm">{feature.icon}</span>
              </div>

              {/* Content */}
              <h3 className="card-title">{t(feature.titleKey)}</h3>
              <p className="card-desc">{t(feature.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
