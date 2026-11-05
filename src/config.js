const allowedRegions = ['mypurecloud.de', 'mypurecloud.ie', 'mypurecloud.com', 'usw2.pure.cloud', 'cac1.pure.cloud', 'aps1.pure.cloud'];
const params = new URLSearchParams(window.location.search);
export const customerConfig = Object.freeze({
  showAgents: params.get('showAgents')?.toLowerCase() !== 'false',
  primaryColor: /^#[0-9a-f]{6}$/i.test(params.get('primaryColor') || '') ? params.get('primaryColor') : '#1A2B67',
  clientId: params.get('clientId') || '',
  region: allowedRegions.includes(params.get('region')) ? params.get('region') : 'mypurecloud.de',
});
