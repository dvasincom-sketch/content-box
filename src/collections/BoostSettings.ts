import type { CollectionConfig } from 'payload'
import { isSuperAdmin } from '../access'

/**
 * Boost-настройки — ПЛАТФОРМЕННЫЙ конфиг (не пер-тенант, не в multiTenant-карте):
 * пресет/образ/реплики/маржа/лимиты аренды сервера Timeweb под транскод.
 *
 * Правит ТОЛЬКО суперадмин в Payload-админке. Автору (клиенту) это не показываем —
 * он лишь жмёт «Ускорить» и платит итоговую цену (маржа внутри, но не видна).
 *
 * Одна запись (синглтон): оператор заводит один документ. lib/boost.ts читает
 * первую строку. Токен Timeweb здесь НЕ хранится — он в env (секрет).
 */
export const BoostSettings: CollectionConfig = {
  slug: 'boost-settings',
  labels: { singular: 'Boost-настройки', plural: 'Boost-настройки' },
  admin: {
    group: 'Платформа',
    useAsTitle: 'id',
    description: 'Конфиг ускоренного транскода (аренда сервера Timeweb). Одна запись на платформу.',
    defaultColumns: ['enabled', 'presetId', 'imageId', 'marginPct'],
  },
  access: {
    read: ({ req: { user } }) => isSuperAdmin(user),
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Boost включён' },
    { name: 'presetId', type: 'text', label: 'ID пресета Timeweb', admin: { description: 'Напр. 6847 (16 vCPU, ru-1). Из GET /presets/servers.' } },
    { name: 'imageId', type: 'text', label: 'ID образа воркера (снапшот)', admin: { description: 'image_id снапшота Timeweb с готовым воркером.' } },
    { name: 'osId', type: 'number', label: 'ID ОС (если без образа)', admin: { description: 'Фолбэк: чистая ОС + cloud-init. Обычно пусто, если задан образ.' } },
    { name: 'location', type: 'text', label: 'Локация', admin: { description: 'Напр. ru-1 (там же, где S3/БД).' } },
    { name: 'replicas', type: 'number', label: 'Реплик воркера', admin: { description: 'Пусто = авто (ядра / «ядер на воркер»).' } },
    { name: 'cpusPerWorker', type: 'number', defaultValue: 7, label: 'Ядер на воркер' },
    { name: 'marginPct', type: 'number', defaultValue: 30, label: 'Маржа, %', admin: { description: 'Наценка платформы поверх реальной аренды. Клиенту не показывается.' } },
    { name: 'maxLifetimeMin', type: 'number', defaultValue: 180, label: 'Лимит жизни сервера, мин', admin: { description: 'Watchdog: принудительно гасит сервер по истечении.' } },
    { name: 'idleMinutes', type: 'number', defaultValue: 10, label: 'Гасить при простое, мин' },
    { name: 'throughputPerHour', type: 'number', defaultValue: 20, label: 'Роликов/час (для оценки)' },
    { name: 'whisperEnabled', type: 'checkbox', defaultValue: true, label: 'Субтитры (whisper) на boost-сервере' },
  ],
  timestamps: true,
}
