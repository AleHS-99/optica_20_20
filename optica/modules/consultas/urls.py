from django.urls import path
from .views import AddConsultaView

app_name = 'consultas'

urlpatterns = [
    path('add/',AddConsultaView.as_view(),name="add_consulta")
]