// public/vue-login.js

const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    // Variáveis reativas para os dados do formulário
    const roles = ref([]);
    const selectedRole = ref('');
    const email = ref('');
    const password = ref('');
    const message = ref('');
    const isSuccess = ref(false);

    // Função para buscar e popular a lista de "Roles"
    const populateRoles = async () => {
      try {
        const response = await fetch('/api/get-roles');
        if (!response.ok) {
          throw new Error(`Failed to load roles: ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          roles.value = data;
        }
      } catch (error) {
        console.error('Error populating roles:', error);
        message.value = 'Error loading roles. Please try again.';
        isSuccess.value = false;
      }
    };

    // Função para lidar com o envio do formulário de login
    const handleLogin = async () => {
      message.value = 'Processing...';
      isSuccess.value = false;

      const data = {
        role: selectedRole.value,
        email: email.value,
        password: password.value
      };

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await response.json();

        message.value = result.message;
        isSuccess.value = result.success;

        if (result.success && result.redirectUrl) {
          // Redireciona para a página de agendamentos em caso de sucesso
          window.location.href = result.redirectUrl;
        }
      } catch (error) {
        console.error('Login error:', error);
        message.value = 'A network error occurred. Please try again.';
        isSuccess.value = false;
      }
    };

    // Chama a função para popular os roles assim que o app for iniciado
    onMounted(populateRoles);

    // Expõe as variáveis e funções para serem usadas no HTML
    return {
      roles,
      selectedRole,
      email,
      password,
      message,
      isSuccess,
      handleLogin
    };
  }
}).mount('#app'); // Monta a aplicação Vue no elemento com id="app"
