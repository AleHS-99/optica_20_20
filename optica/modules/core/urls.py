from django.urls import path
from django.contrib.auth.views import LogoutView
from .views import LoginFormView, HomeView, UserChangePasswordView

app_name = 'core'

urlpatterns = [
    path('accounts/login/',LoginFormView.as_view(),name='login'),
    path('logout/',LogoutView.as_view(next_page="core:login"), name='logout'),
    path('',HomeView.as_view(), name='home'),
    path('usuario/pass_change', UserChangePasswordView.as_view(), name='pass_change'),
]