<!-- client/src/views/AboutView.vue -->
<template>
  <div class="about-view">
    <!-- 页面标题区 -->
    <header class="about-header">
      <h1 class="page-title">About {{ appName }}</h1>
      <p class="page-subtitle">Our mission, vision, and values</p>
    </header>

    <!-- 主要内容区 -->
    <main class="about-content">
      <!-- 公司简介 -->
      <section class="about-section">
        <h2 class="section-title">Company Overview</h2>
        <div class="section-content">
          <p>{{ companyDescription }}</p>
          <div class="stats-grid">
            <div v-for="stat in companyStats" :key="stat.id" class="stat-card">
              <h3>{{ stat.value }}</h3>
              <p>{{ stat.label }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 团队展示 -->
      <section class="about-section">
        <h2 class="section-title">Our Team</h2>
        <div class="team-grid">
          <div v-for="member in teamMembers" :key="member.id" class="team-card">
            <div class="avatar-placeholder" :style="{ backgroundColor: stringToColor(member.name) }">
              {{ getInitials(member.name) }}
            </div>
            <h3>{{ member.name }}</h3>
            <p class="role">{{ member.role }}</p>
            <p class="bio">{{ member.bio }}</p>
          </div>
        </div>
      </section>

      <!-- 时间轴 -->
      <section class="about-section">
        <h2 class="section-title">Our Journey</h2>
        <div class="timeline">
          <div v-for="(event, index) in timelineEvents" :key="index" class="timeline-event">
            <div class="event-date">{{ event.date }}</div>
            <div class="event-content">
              <h3>{{ event.title }}</h3>
              <p>{{ event.description }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 联系信息 -->
    <footer class="about-footer">
      <h2>Get in Touch</h2>
      <div class="contact-methods">
        <a 
          v-for="contact in contactMethods" 
          :key="contact.id"
          :href="contact.url" 
          class="contact-link"
        >
          <span class="contact-icon" v-html="contact.icon"></span>
          {{ contact.label }}
        </a>
      </div>
    </footer>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

// 内联SVG图标
const contactIcons = {
  email: `<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>`,
  location: `<svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
}

export default {
  name: 'AboutView',

  setup() {
    const authStore = useAuthStore()

    // 响应式数据
    const appName = computed(() => import.meta.env.VITE_APP_NAME || 'King Platform')
    const companyDescription = ref('We are a technology company dedicated to building innovative solutions that empower businesses and individuals. Our platform combines cutting-edge technology with user-centric design to deliver exceptional experiences.')
    
    const companyStats = ref([
      { id: 1, value: '2018', label: 'Founded' },
      { id: 2, value: '50+', label: 'Employees' },
      { id: 3, value: '10K+', label: 'Customers' },
      { id: 4, value: 'Global', label: 'Presence' }
    ])

    const teamMembers = ref([
      {
        id: 1,
        name: 'Alex Johnson',
        role: 'CEO & Founder',
        bio: 'Visionary leader with 15+ years in tech industry'
      },
      {
        id: 2,
        name: 'Sarah Chen',
        role: 'CTO',
        bio: 'Technology strategist and software architect'
      }
    ])

    const timelineEvents = ref([
      {
        date: '2018 Q1',
        title: 'Company Founded',
        description: 'Started with a small team of 5 people working on initial product concept'
      },
      {
        date: '2019 Q3',
        title: 'First Major Release',
        description: 'Launched version 1.0 of our platform to early adopters'
      }
    ])

    const contactMethods = ref([
      {
        id: 1,
        label: 'contact@example.com',
        url: 'mailto:contact@example.com',
        icon: contactIcons.email
      },
      {
        id: 2,
        label: '+1 (555) 123-4567',
        url: 'tel:+15551234567',
        icon: contactIcons.phone
      },
      {
        id: 3,
        label: 'San Francisco, CA',
        url: 'https://maps.google.com',
        icon: contactIcons.location
      }
    ])

    // 工具方法
    const getInitials = (name) => {
      return name.split(' ').map(part => part[0]).join('')
    }

    const stringToColor = (str) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
      }
      const hue = Math.abs(hash % 360)
      return `hsl(${hue}, 70%, 65%)`
    }

    return {
      appName,
      companyDescription,
      companyStats,
      teamMembers,
      timelineEvents,
      contactMethods,
      getInitials,
      stringToColor
    }
  }
}
</script>

<style lang="scss" scoped>
@import "@/assets/scss/variables";

.about-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.about-header {
  text-align: center;
  margin-bottom: 3rem;

  .page-title {
    font-size: 2.5rem;
    color: $color-primary;
    margin-bottom: 0.5rem;
  }

  .page-subtitle {
    font-size: 1.2rem;
    color: $color-gray-600;
  }
}

.about-section {
  margin-bottom: 4rem;

  .section-title {
    font-size: 1.8rem;
    color: $color-gray-900;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid $color-primary-light;
  }

  .section-content {
    line-height: 1.6;
    color: $color-gray-700;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;

  .stat-card {
    background: $color-white;
    padding: 1.5rem;
    border-radius: $border-radius-md;
    box-shadow: $box-shadow-sm;
    text-align: center;

    h3 {
      font-size: 2rem;
      color: $color-primary;
      margin-bottom: 0.5rem;
    }

    p {
      color: $color-gray-600;
      font-size: 0.9rem;
    }
  }
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;

  .team-card {
    background: $color-white;
    padding: 1.5rem;
    border-radius: $border-radius-md;
    box-shadow: $box-shadow-sm;
    text-align: center;

    .avatar-placeholder {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
    }

    h3 {
      margin-bottom: 0.25rem;
    }

    .role {
      color: $color-primary;
      font-weight: 500;
      margin-bottom: 0.75rem;
    }

    .bio {
      color: $color-gray-600;
      font-size: 0.9rem;
    }
  }
}

.timeline {
  position: relative;
  padding-left: 2rem;

  &::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: $color-primary-light;
  }
}

.timeline-event {
  position: relative;
  padding-bottom: 2rem;
  padding-left: 2rem;

  &:last-child {
    padding-bottom: 0;
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: $color-primary;
  }

  .event-date {
    font-weight: 500;
    color: $color-primary-dark;
    margin-bottom: 0.5rem;
  }

  .event-content {
    background: $color-white;
    padding: 1rem;
    border-radius: $border-radius-md;
    box-shadow: $box-shadow-xs;

    h3 {
      margin-bottom: 0.5rem;
      color: $color-gray-900;
    }

    p {
      color: $color-gray-600;
    }
  }
}

.about-footer {
  margin-top: 4rem;
  padding-top: 3rem;
  border-top: 1px solid $color-gray-200;
  text-align: center;

  h2 {
    margin-bottom: 1.5rem;
    color: $color-gray-900;
  }
}

.contact-methods {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem;
}

.contact-link {
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: $color-white;
  border-radius: $border-radius-md;
  box-shadow: $box-shadow-sm;
  color: $color-gray-700;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $box-shadow-md;
    color: $color-primary;
  }

  .contact-icon {
    display: inline-flex;
    margin-right: 0.75rem;
    width: 20px;
    height: 20px;

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }
}

@media (max-width: 768px) {
  .about-view {
    padding: 1rem;
  }

  .about-header {
    margin-bottom: 2rem;

    .page-title {
      font-size: 2rem;
    }
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .team-grid {
    grid-template-columns: 1fr;
  }
}
</style>